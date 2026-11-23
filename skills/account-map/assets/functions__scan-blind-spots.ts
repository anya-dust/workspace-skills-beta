// Database: accountmap
import { z } from "zod";
import {
  blindSpots, contacts, db, DB, edges, eq, listProductUsage, listRoles, maps, snapshot, snapshotZ,
} from "./lib/store.ts";
import {
  findFreeSlot, isLeader, MAX_DRIFT, overlaps, pickSeatAnchor, reportTitlesFor, SEATS,
  slotUnder, suggestPerson, warmPath,
} from "./lib/gaps.ts";
import { emailFor, domainForCompany, linkedinFor } from "./lib/synth.ts";

export const schema = {
  description:
    "Scan an account map for blind spots: buying-committee seats nobody fills, company functions with no contact, leaders whose org is unmapped, and relationships that have gone quiet. Ghost cards get a suggested person and a warm introduction path. Re-running updates existing spots instead of duplicating them, and never revives ones you dismissed.",
  userIdentity: "workspace_user_required",
  input: z.object({ mapId: z.number() }).strict(),
  output: z.object({
    found: z.number(),
    ghosts: z.number(),
    warnings: z.number(),
    closed: z.number(),
    snapshot: snapshotZ,
  }),
};

const DECAY_DAYS = 45;
const MAX_ORG_HOLES = 3;

type Candidate = {
  signature: string;
  kind: string;
  severity: string;
  gapTitle: string;
  rationale: string;
  anchorContactId: number | null;
  /** Ghosts get a canvas slot; anchored warnings render on the contact card instead. */
  ghost: boolean;
  suggestTitles?: string[];
  wantX?: number;
  wantY?: number;
};

export default {
  async fetch(request: Request): Promise<Response> {
    const { mapId } = await request.json();
    const map = db(DB).select({ id: maps.id, name: maps.name }).from(maps)
      .where(eq(maps.id, mapId)).get();
    if (!map) return Response.json({ error: `No map with id ${mapId}` }, { status: 404 });

    const cs = db(DB).select({
      id: contacts.id, name: contacts.name, jobTitle: contacts.jobTitle, roleId: contacts.roleId,
      isContacted: contacts.isContacted, lastContactedAt: contacts.lastContactedAt,
      posX: contacts.posX, posY: contacts.posY,
    }).from(contacts).where(eq(contacts.mapId, mapId)).all();

    const es = db(DB).select({ sourceId: edges.sourceId, targetId: edges.targetId, kind: edges.kind })
      .from(edges).where(eq(edges.mapId, mapId)).all();

    const roleList = listRoles();
    const roleIdByName = new Map(roleList.map((r) => [(r.name ?? "").trim(), r.id]));
    const roleNameById = new Map(roleList.map((r) => [r.id, r.name ?? ""]));
    const usageByContact = new Map(listProductUsage(mapId).map((u) => [u.contactId, u]));

    const now = new Date();
    const today = now.getTime();
    const candidates: Candidate[] = [];

    // ---- 1. committee seats: a deal role nobody holds, or a function nobody covers ----
    for (const seat of SEATS) {
      // Every ghost sits under the executive whose org would own the seat, so the gap reads
      // as a break in the org chart instead of a card parked off to the side.
      const anchor = pickSeatAnchor(seat.anchorPatterns, cs);
      const want = anchor ? slotUnder(anchor) : { x: 0, y: 0 };

      if (seat.roleName) {
        const rid = roleIdByName.get(seat.roleName);
        const holders = rid == null ? [] : cs.filter((c) => c.roleId === rid);
        if (holders.length === 0) {
          candidates.push({
            signature: `seat:${seat.key}`,
            kind: "role_coverage",
            severity: seat.severity,
            gapTitle: seat.label,
            rationale: seat.why,
            anchorContactId: anchor?.id ?? null,
            ghost: true,
            suggestTitles: seat.gapTitles,
            wantX: want.x,
            wantY: want.y,
          });
        } else if (!holders.some((h) => h.isContacted)) {
          // The seat is mapped but the relationship does not exist yet.
          const h = holders[0];
          candidates.push({
            signature: `seat-cold:${seat.key}`,
            kind: "role_coverage",
            severity: seat.severity === "critical" ? "critical" : "high",
            gapTitle: `${seat.label} never engaged`,
            rationale: `${h.name ?? "This contact"} is your ${seat.label.toLowerCase()} on paper but has never been contacted. The seat looks filled in the CRM and is empty in practice.`,
            anchorContactId: h.id,
            ghost: false,
          });
        }
        continue;
      }
      if (seat.titlePattern) {
        const covered = cs.some((c) => seat.titlePattern!.test(c.jobTitle ?? ""));
        if (!covered) {
          candidates.push({
            signature: `seat:${seat.key}`,
            kind: "function_coverage",
            severity: seat.severity,
            gapTitle: seat.label,
            rationale: seat.why,
            anchorContactId: anchor?.id ?? null,
            ghost: true,
            suggestTitles: seat.gapTitles,
            wantX: want.x,
            wantY: want.y,
          });
        }
      }
    }

    // ---- 2. org holes: a leader you engage whose own org is unmapped ----
    const hasReport = new Set(
      es.filter((e) => (e.kind ?? "reporting") === "reporting").map((e) => e.sourceId),
    );
    const leaders = cs
      .filter((c) => isLeader(c.jobTitle) && !hasReport.has(c.id))
      .map((c) => {
        const roleName = c.roleId != null ? roleNameById.get(c.roleId) ?? "" : "";
        // Prioritise the leaders where an unmapped org actually costs you the deal.
        let weight = 0;
        if (/Champion|Economic Buyer/.test(roleName)) weight += 5;
        if (/Evaluator/.test(roleName)) weight += 3;
        if (c.isContacted) weight += 2;
        if (/chief|president|ceo|chairman/i.test(c.jobTitle ?? "")) weight += 1;
        return { c, weight, roleName };
      })
      .filter((x) => x.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_ORG_HOLES);

    for (const { c, roleName } of leaders) {
      candidates.push({
        signature: `org:${c.id}`,
        kind: "org_hole",
        severity: /Champion|Economic Buyer/.test(roleName) ? "high" : "medium",
        gapTitle: "Unmapped direct report",
        rationale: `${c.name ?? "This leader"} has no direct reports on the map. The people who will actually run the evaluation sit one level below and you cannot see them.`,
        anchorContactId: c.id,
        ghost: true,
        suggestTitles: reportTitlesFor(c.jobTitle),
        wantX: slotUnder(c).x,
        wantY: slotUnder(c).y,
      });
    }

    // ---- 3. engagement decay: mapped, engaged once, now quiet ----
    for (const c of cs) {
      if (!c.isContacted) continue;
      const roleName = c.roleId != null ? roleNameById.get(c.roleId) ?? "" : "";
      const u = usageByContact.get(c.id);
      const days = c.lastContactedAt
        ? Math.round((today - new Date(`${c.lastContactedAt}T00:00:00Z`).getTime()) / 86400000)
        : null;

      const reasons: string[] = [];
      if (days != null && days >= DECAY_DAYS) reasons.push(`no contact in ${days} days`);
      if (u?.seatStatus === "churned") reasons.push("their product seat went inactive");
      else if ((u?.trendPct ?? 0) <= -30) reasons.push(`usage down ${Math.abs(Math.round(u!.trendPct!))}% over 30 days`);
      if (/Champion/.test(roleName) && (u?.healthScore ?? 100) < 40) reasons.push("champion health score is low");
      if (reasons.length === 0) continue;

      candidates.push({
        signature: `decay:${c.id}`,
        kind: "engagement_decay",
        severity: /Champion|Economic Buyer/.test(roleName) ? "critical" : reasons.length > 1 ? "high" : "medium",
        gapTitle: roleName ? `${roleName} going cold` : "Relationship going cold",
        rationale: `${c.name ?? "This contact"}: ${reasons.join(", ")}.`,
        anchorContactId: c.id,
        ghost: false,
      });
    }

    // ---- reconcile against what is already stored ----
    const existing = db(DB).select({
      id: blindSpots.id, signature: blindSpots.signature, status: blindSpots.status,
      posX: blindSpots.posX, posY: blindSpots.posY,
    }).from(blindSpots).where(eq(blindSpots.mapId, mapId)).all();
    const bySig = new Map(existing.map((e) => [e.signature, e]));
    const seen = new Set<string>();

    const taken: { x: number; y: number; spotId?: number }[] = cs.map((c) => ({
      x: c.posX ?? 0, y: c.posY ?? 0,
    }));
    for (const e of existing) {
      if (e.posX != null && e.posY != null) taken.push({ x: e.posX, y: e.posY, spotId: e.id });
    }

    const domain = domainForCompany(map.name);
    let ghosts = 0;
    let warnings = 0;

    for (const cand of candidates) {
      seen.add(cand.signature);
      const prior = bySig.get(cand.signature);
      if (cand.ghost) ghosts++; else warnings++;

      if (prior) {
        // Refresh the reasoning, but never resurrect a dismissal. A card the user nudged
        // stays where they put it; one stranded far from the contact it belongs under, or
        // parked off the map by an older scan, gets pulled back into the org chart.
        let moved: { x: number; y: number } | null = null;
        if (cand.ghost && prior.status === "open" && cand.wantX != null && cand.wantY != null) {
          const others = taken.filter((t) => t.spotId !== prior.id);
          const stray = prior.posX == null || prior.posY == null
            || Math.abs(prior.posX - cand.wantX) > MAX_DRIFT
            || Math.abs(prior.posY - cand.wantY) > MAX_DRIFT
            || overlaps({ x: prior.posX, y: prior.posY }, others);
          if (stray) {
            moved = findFreeSlot({ x: cand.wantX, y: cand.wantY }, others);
            taken.push({ ...moved, spotId: prior.id });
          }
        }
        db(DB).update(blindSpots).set({
          severity: cand.severity,
          gapTitle: cand.gapTitle,
          rationale: cand.rationale,
          anchorContactId: cand.anchorContactId,
          ...(moved ? { posX: moved.x, posY: moved.y } : {}),
          updatedAt: now,
        }).where(eq(blindSpots.id, prior.id)).run();
        continue;
      }

      let person: { name: string; title: string } | null = null;
      let slot: { x: number; y: number } | null = null;
      if (cand.ghost) {
        person = suggestPerson(cand.signature, cand.suggestTitles ?? [cand.gapTitle]);
        slot = findFreeSlot({ x: cand.wantX ?? 0, y: cand.wantY ?? 0 }, taken);
        taken.push(slot);
      }
      const warm = person ? warmPath(cand.signature, person.name) : null;
      const roleGuess = cand.kind === "role_coverage"
        ? roleIdByName.get(cand.gapTitle) ?? null
        : roleIdByName.get("Target to Engage") ?? null;

      db(DB).insert(blindSpots).values({
        mapId,
        kind: cand.kind,
        signature: cand.signature,
        severity: cand.severity,
        gapTitle: cand.gapTitle,
        rationale: cand.rationale,
        anchorContactId: cand.anchorContactId,
        suggestedName: person?.name ?? null,
        suggestedTitle: person?.title ?? null,
        suggestedEmail: person ? emailFor(person.name, domain) : null,
        suggestedLinkedinUrl: person ? linkedinFor(person.name, cand.signature) : null,
        suggestedAvatarUrl: null,
        suggestedRoleId: person ? roleGuess : null,
        warmVia: warm?.via ?? null,
        warmViaTitle: warm?.viaTitle ?? null,
        warmDetail: warm?.detail ?? null,
        status: "open",
        resolvedContactId: null,
        posX: slot?.x ?? null,
        posY: slot?.y ?? null,
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    // A gap that no longer exists is deleted, unless the user resolved or dismissed it:
    // those rows are their decision and stay as a record of it.
    let closed = 0;
    for (const e of existing) {
      if (seen.has(e.signature ?? "") || e.status !== "open") continue;
      db(DB).delete(blindSpots).where(eq(blindSpots.id, e.id)).run();
      closed++;
    }

    return Response.json({
      found: candidates.length, ghosts, warnings, closed, snapshot: snapshot(mapId),
    });
  },
};
