// The next-best-action queue. Actions are DERIVED from the map on every read rather than
// stored, so they cannot drift from the data they describe; only the rep's decision about an
// action is persisted, keyed by `key`.
//
// Every action carries the agent prompt that would actually do the work, because the point of
// the queue is not to tell the rep what to do, it is to let them hand it off in one click.

export type ActionCategory = "intro" | "reengage" | "first-touch" | "expand" | "renewal" | "hygiene";

export type Action = {
  key: string;
  category: ActionCategory;
  severity: "critical" | "high" | "medium" | "low";
  score: number;
  title: string;
  why: string;
  contactId: number | null;
  blindSpotId: number | null;
  /** Prompt handed to the agent when the rep clicks through. */
  agentPrompt: string;
  agentTitle: string;
  cta: string;
};

type Ctx = {
  companyName: string;
  contacts: {
    id: number; name: string | null; jobTitle: string | null; roleId: number | null;
    isContacted: boolean | null; lastContactedAt: string | null; email: string | null;
    linkedinUrl: string | null;
  }[];
  roleNameById: Map<number, string>;
  blindSpots: {
    id: number; kind: string | null; severity: string | null; gapTitle: string | null;
    rationale: string | null; anchorContactId: number | null; suggestedName: string | null;
    suggestedTitle: string | null; warmVia: string | null; warmViaTitle: string | null;
    warmDetail: string | null; status: string | null; posX: number | null;
  }[];
  usageByContact: Map<number, {
    seatStatus: string | null; healthScore: number | null; trendPct: number | null;
    sessions30d: number | null; seatsManaged: number | null; topFeature: string | null;
    lastSeenAt: string | null; licenseTier: string | null;
  }>;
  account: {
    seatsLicensed: number | null; seatsActive: number | null; healthScore: number | null;
    trendPct: number | null; arr: number | null; renewalDate: string | null;
    openTickets: number | null; csat: number | null;
  } | null;
};

const SEV_SCORE: Record<string, number> = { critical: 100, high: 78, medium: 56 };

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(`${iso}T00:00:00Z`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((Date.now() - t) / 86400000);
}

function roleOf(c: { roleId: number | null }, ctx: Ctx): string {
  return c.roleId != null ? ctx.roleNameById.get(c.roleId) ?? "" : "";
}

export function buildActions(ctx: Ctx): Action[] {
  const out: Action[] = [];
  const co = ctx.companyName;
  const byId = new Map(ctx.contacts.map((c) => [c.id, c]));

  // ---- 1. warm introductions into the ghost cards ----
  for (const b of ctx.blindSpots) {
    if (b.status !== "open" || b.posX == null || !b.suggestedName) continue;
    const anchor = b.anchorContactId != null ? byId.get(b.anchorContactId) : null;
    const warm = b.warmVia
      ? `${b.warmVia}${b.warmViaTitle ? ` (${b.warmViaTitle})` : ""} can open the door: ${b.warmDetail}`
      : "No warm path found yet, so this needs a cold approach.";
    out.push({
      key: `intro:${b.id}`,
      category: "intro",
      severity: (b.severity as Action["severity"]) ?? "high",
      score: (SEV_SCORE[b.severity ?? ""] ?? 60) + (b.warmVia ? 12 : 0),
      title: b.warmVia
        ? `Get introduced to ${b.suggestedName} via ${b.warmVia.split(" ")[0]}`
        : `Find a route to ${b.suggestedName}`,
      why: `${b.gapTitle} is an open blind spot. ${b.rationale ?? ""}`.trim(),
      contactId: b.anchorContactId,
      blindSpotId: b.id,
      cta: "Draft the intro",
      agentTitle: `Intro to ${b.suggestedName} at ${co}`,
      agentPrompt: [
        `I am working the ${co} account and have a blind spot to close.`,
        ``,
        `The gap: ${b.gapTitle}. ${b.rationale ?? ""}`,
        `Who I think fills it: ${b.suggestedName}, ${b.suggestedTitle}.`,
        anchor ? `They sit near ${anchor.name} (${anchor.jobTitle}) on our account map.` : "",
        `Warm path: ${warm}`,
        ``,
        b.warmVia
          ? `Please: (1) research ${b.suggestedName} and confirm the title and remit, (2) draft a short Slack message asking ${b.warmVia} for the introduction, and (3) draft the forwardable blurb ${b.warmVia} can send on to ${b.suggestedName}. Keep both under 120 words and make the value specific to their role.`
          : `Please: (1) research ${b.suggestedName} and confirm the title and remit, (2) find any connection path into them from our team, and (3) draft a cold outreach email that leads with a reason to care rather than a product pitch.`,
      ].filter(Boolean).join("\n"),
    });
  }

  // ---- 2. relationships going cold ----
  for (const b of ctx.blindSpots) {
    if (b.status !== "open" || b.kind !== "engagement_decay" || b.anchorContactId == null) continue;
    const c = byId.get(b.anchorContactId);
    if (!c) continue;
    const u = ctx.usageByContact.get(c.id);
    const gone = daysSince(c.lastContactedAt);
    out.push({
      key: `reengage:${c.id}`,
      category: "reengage",
      severity: (b.severity as Action["severity"]) ?? "high",
      score: (SEV_SCORE[b.severity ?? ""] ?? 60) + 4,
      title: `Re-engage ${c.name}`,
      why: b.rationale ?? "This relationship has gone quiet.",
      contactId: c.id,
      blindSpotId: b.id,
      cta: "Draft re-engagement",
      agentTitle: `Re-engage ${c.name} at ${co}`,
      agentPrompt: [
        `${c.name} (${c.jobTitle}) at ${co} is going cold and I need to fix it.`,
        ``,
        `Their role on our map: ${roleOf(c, ctx) || "no role assigned"}.`,
        gone != null ? `Last contacted: ${c.lastContactedAt} (${gone} days ago).` : `No recorded contact date.`,
        u ? `Product usage: seat is ${u.seatStatus}, health score ${u.healthScore}, 30-day trend ${u.trendPct}%, ${u.sessions30d} sessions, last seen ${u.lastSeenAt ?? "never"}.` : `No product usage on record.`,
        ``,
        `Please: (1) search our email, Slack, meeting notes and CRM for everything that has happened with ${c.name} and summarise where we actually left off, (2) tell me what changed at ${co} or in their world that gives me a legitimate reason to reach out now, and (3) draft a re-engagement email that opens with that reason and asks for one specific, small next step. Do not send anything.`,
      ].filter(Boolean).join("\n"),
    });
  }

  // ---- 3. key roles that have never been touched ----
  for (const c of ctx.contacts) {
    if (c.isContacted) continue;
    const role = roleOf(c, ctx);
    const isKey = /Economic Buyer|Champion|Evaluator/.test(role);
    if (!isKey) continue;
    const critical = /Economic Buyer|Champion - Executive/.test(role);
    out.push({
      key: `first-touch:${c.id}`,
      category: "first-touch",
      severity: critical ? "critical" : "high",
      score: critical ? 96 : 74,
      title: `First touch with ${c.name}`,
      why: `${c.name} is your ${role} on paper but has never been contacted. The CRM says this seat is covered; in practice it is empty.`,
      contactId: c.id,
      blindSpotId: null,
      cta: "Draft first touch",
      agentTitle: `First touch: ${c.name} at ${co}`,
      agentPrompt: [
        `I need to open a relationship with ${c.name} (${c.jobTitle}) at ${co}.`,
        ``,
        `They are marked as our ${role} on the account map but have never been contacted, which is a real risk: the deal assumes their support and we have no evidence of it.`,
        ctx.account ? `Account context: $${ctx.account.arr} ARR, ${ctx.account.seatsActive} of ${ctx.account.seatsLicensed} seats active, account health ${ctx.account.healthScore}, renewal ${ctx.account.renewalDate}.` : "",
        ``,
        `Please: (1) research ${c.name} and tell me what they are measured on, (2) check whether anyone on our side already has a connection to them, and (3) draft a first-touch email tailored to a ${role.toLowerCase()} that leads with their business outcome and our actual usage story at ${co}, not with features. Give me a Slack-length version too.`,
      ].filter(Boolean).join("\n"),
    });
  }

  // ---- 4. expansion signals: power users nobody is farming ----
  for (const c of ctx.contacts) {
    const u = ctx.usageByContact.get(c.id);
    if (!u || u.seatStatus !== "active") continue;
    const strong = (u.healthScore ?? 0) >= 70 && (u.trendPct ?? 0) > 10;
    if (!strong || (u.seatsManaged ?? 0) < 20) continue;
    out.push({
      key: `expand:${c.id}`,
      category: "expand",
      severity: "medium",
      score: 58 + Math.min(14, Math.round((u.seatsManaged ?? 0) / 20)),
      title: `Build the expansion case with ${c.name}`,
      why: `Health ${u.healthScore}, usage ${u.trendPct! > 0 ? "up" : "down"} ${Math.abs(Math.round(u.trendPct ?? 0))}% and roughly ${u.seatsManaged} people in their org. This is the strongest adoption story on the account and nobody is using it.`,
      contactId: c.id,
      blindSpotId: null,
      cta: "Build the case",
      agentTitle: `Expansion case: ${c.name} at ${co}`,
      agentPrompt: [
        `${c.name} (${c.jobTitle}) at ${co} is one of our strongest users and I want to turn that into expansion.`,
        ``,
        `Their usage: health score ${u.healthScore}, 30-day trend ${u.trendPct}%, ${u.sessions30d} sessions, top feature "${u.topFeature}", ${u.licenseTier} tier, roughly ${u.seatsManaged} people in their org.`,
        ctx.account ? `Account: $${ctx.account.arr} ARR, ${ctx.account.seatsActive} of ${ctx.account.seatsLicensed} seats active, renewal ${ctx.account.renewalDate}.` : "",
        ``,
        `Please: (1) quantify the value their team is getting in terms a ${c.jobTitle} would use, (2) identify the adjacent teams at ${co} that look like theirs and would benefit next, and (3) draft the note asking ${c.name} to co-present that story internally. Include the three numbers I should lead with.`,
      ].filter(Boolean).join("\n"),
    });
  }

  // ---- 5. renewal exposure ----
  if (ctx.account?.renewalDate) {
    const until = -(daysSince(ctx.account.renewalDate) ?? 0);
    const openCritical = ctx.blindSpots.filter((b) => b.status === "open" && b.severity === "critical").length;
    if (until <= 240 && until > -30) {
      const seatPct = ctx.account.seatsLicensed
        ? Math.round(((ctx.account.seatsActive ?? 0) / ctx.account.seatsLicensed) * 100)
        : 0;
      out.push({
        key: `renewal:${ctx.account.renewalDate}`,
        category: "renewal",
        severity: openCritical > 0 ? "critical" : until <= 120 ? "high" : "medium",
        score: (openCritical > 0 ? 99 : until <= 120 ? 82 : 62),
        title: `Build the renewal plan (${until} days out)`,
        why: `Renewal lands ${ctx.account.renewalDate} with ${seatPct}% seat utilisation, health ${ctx.account.healthScore} and ${openCritical} critical blind spot${openCritical === 1 ? "" : "s"} still open.`,
        contactId: null,
        blindSpotId: null,
        cta: "Draft the plan",
        agentTitle: `${co} renewal plan`,
        agentPrompt: [
          `Build me the renewal plan for ${co}.`,
          ``,
          `Commercials: $${ctx.account.arr} ARR, renewal ${ctx.account.renewalDate} (${until} days out).`,
          `Adoption: ${ctx.account.seatsActive} of ${ctx.account.seatsLicensed} seats active (${seatPct}%), account health ${ctx.account.healthScore}, 12-month trend ${ctx.account.trendPct}%.`,
          `Support: ${ctx.account.openTickets} open tickets, CSAT ${ctx.account.csat}.`,
          `Committee: ${openCritical} critical blind spots still open on the account map.`,
          ``,
          `Please: (1) assess renewal risk and tell me honestly whether this is a renewal or a save, (2) list the specific gaps in the buying committee I must close before the renewal conversation and who should own each, (3) build the value narrative from the adoption numbers above, and (4) give me a week-by-week plan working back from ${ctx.account.renewalDate}.`,
        ].join("\n"),
      });
    }
  }

  // ---- 6. map hygiene, so the map stays worth trusting ----
  const thin = ctx.contacts.filter((c) => !c.linkedinUrl || !c.email || c.roleId == null);
  if (thin.length >= 3) {
    out.push({
      key: `hygiene:${thin.length}`,
      category: "hygiene",
      severity: "low",
      score: 22,
      title: `Enrich ${thin.length} thin contacts`,
      why: `${thin.length} people on the map are missing an email, a LinkedIn profile or a deal role. Coverage scoring is only as honest as the data under it.`,
      contactId: null,
      blindSpotId: null,
      cta: "Enrich the map",
      agentTitle: `Enrich the ${co} account map`,
      agentPrompt: [
        `Help me clean up the ${co} account map.`,
        ``,
        `These contacts are missing an email, a LinkedIn profile, or a deal role: ${thin.map((c) => `${c.name} (${c.jobTitle})`).join("; ")}.`,
        ``,
        `Please research each one and give me a table with: name, confirmed current title, LinkedIn URL, likely email pattern, who they report to, and the deal role you would assign them (Economic Buyer, Champion, Evaluator, Builder, Super User, or Target to Engage) with a one-line reason. Flag anyone who looks like they have left ${co}.`,
      ].join("\n"),
    });
  }

  return out.sort((a, b) => b.score - a.score);
}
