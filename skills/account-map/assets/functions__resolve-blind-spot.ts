// Database: accountmap
import { z } from "zod";
import {
  blindSpots, contacts, db, DB, edges, eq, getBlindSpot, snapshot, snapshotZ,
} from "./lib/store.ts";

export const schema = {
  description:
    "Promote a blind spot's suggested person into a real contact on the map, at the ghost card's position, wired to its anchor contact when it has one. Marks the blind spot resolved and returns the refreshed snapshot.",
  userIdentity: "workspace_user_required",
  input: z.object({
    id: z.number(),
    // Optional overrides so the Frame can let the user correct the suggestion first.
    name: z.string().optional(),
    jobTitle: z.string().optional(),
    roleId: z.number().nullable().optional(),
  }).strict(),
  output: z.object({ contactId: z.number(), snapshot: snapshotZ }),
};

export default {
  async fetch(request: Request): Promise<Response> {
    const { id, name, jobTitle, roleId } = await request.json();
    const spot = getBlindSpot(id);
    if (!spot) return Response.json({ error: `No blind spot with id ${id}` }, { status: 404 });
    if (spot.mapId == null) {
      return Response.json({ error: "Blind spot is not attached to a map" }, { status: 400 });
    }
    if (spot.status === "resolved" && spot.resolvedContactId != null) {
      // Idempotent: clicking Add twice must not create a second card.
      return Response.json({ contactId: spot.resolvedContactId, snapshot: snapshot(spot.mapId) });
    }

    const now = new Date();
    const row = db(DB).insert(contacts).values({
      mapId: spot.mapId,
      name: name ?? spot.suggestedName ?? "Unknown",
      jobTitle: jobTitle ?? spot.suggestedTitle ?? spot.gapTitle ?? null,
      email: spot.suggestedEmail ?? null,
      linkedinUrl: spot.suggestedLinkedinUrl ?? null,
      notes: spot.rationale ?? null,
      customContext: spot.warmVia
        ? `Warm path: ${spot.warmVia}${spot.warmViaTitle ? ` (${spot.warmViaTitle})` : ""}. ${spot.warmDetail ?? ""}`.trim()
        : null,
      isContacted: false,
      roleId: roleId !== undefined ? roleId : spot.suggestedRoleId ?? null,
      avatarUrl: spot.suggestedAvatarUrl ?? null,
      crmUrl: null,
      ownerName: null,
      lastContactedAt: null,
      posX: spot.posX ?? 0,
      posY: spot.posY ?? 0,
      createdAt: now,
      updatedAt: now,
    }).returning({ id: contacts.id }).get();

    // An org hole knows who the new person reports to, so draw that edge for free.
    if (spot.kind === "org_hole" && spot.anchorContactId != null) {
      db(DB).insert(edges).values({
        mapId: spot.mapId,
        sourceId: spot.anchorContactId,
        targetId: row.id,
        kind: "reporting",
        createdAt: now,
      }).run();
    }

    db(DB).update(blindSpots)
      .set({ status: "resolved", resolvedContactId: row.id, updatedAt: now })
      .where(eq(blindSpots.id, id)).run();

    return Response.json({ contactId: row.id, snapshot: snapshot(spot.mapId) });
  },
};
