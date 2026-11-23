// Database: accountmap
import { z } from "zod";
import {
  accountUsage, actionState, blindSpots, contacts, db, DB, eq, getAccountUsage, listBlindSpots,
  listProductUsage, listRoles, maps,
} from "./lib/store.ts";
import { buildActions } from "./lib/actions.ts";

export const schema = {
  description:
    "Return the ranked next-best-action queue for an account map: warm introductions into blind spots, relationships going cold, untouched committee seats, expansion signals, renewal exposure and map hygiene. Each action carries the agent prompt that would do the work. Actions are derived from the map on every call; only done/snoozed state is stored.",
  userIdentity: "workspace_user_required",
  input: z.object({ mapId: z.number(), includeClosed: z.boolean().optional() }).strict(),
  output: z.object({
    actions: z.array(z.object({
      key: z.string(),
      category: z.string(),
      severity: z.string(),
      score: z.number(),
      title: z.string(),
      why: z.string(),
      contactId: z.number().nullable(),
      blindSpotId: z.number().nullable(),
      agentPrompt: z.string(),
      agentTitle: z.string(),
      cta: z.string(),
      status: z.string(),
      agentConversationUrl: z.string().nullable(),
    })),
    openCount: z.number(),
    doneCount: z.number(),
  }),
};

export default {
  async fetch(request: Request): Promise<Response> {
    const { mapId, includeClosed = true } = await request.json();
    const map = db(DB).select({ id: maps.id, name: maps.name }).from(maps)
      .where(eq(maps.id, mapId)).get();
    if (!map) return Response.json({ error: `No map with id ${mapId}` }, { status: 404 });

    const cs = db(DB).select({
      id: contacts.id, name: contacts.name, jobTitle: contacts.jobTitle, roleId: contacts.roleId,
      isContacted: contacts.isContacted, lastContactedAt: contacts.lastContactedAt,
      email: contacts.email, linkedinUrl: contacts.linkedinUrl,
    }).from(contacts).where(eq(contacts.mapId, mapId)).all();

    const built = buildActions({
      companyName: map.name ?? "this account",
      contacts: cs,
      roleNameById: new Map(listRoles().map((r) => [r.id, r.name ?? ""])),
      blindSpots: listBlindSpots(mapId),
      usageByContact: new Map(listProductUsage(mapId).map((u) => [u.contactId as number, u])),
      account: getAccountUsage(mapId),
    });

    const stateRows = db(DB).select({
      actionKey: actionState.actionKey, status: actionState.status,
      agentConversationUrl: actionState.agentConversationUrl,
    }).from(actionState).where(eq(actionState.mapId, mapId)).all();
    const stateByKey = new Map(stateRows.map((r) => [r.actionKey, r]));

    const merged = built.map((a) => {
      const st = stateByKey.get(a.key);
      return {
        ...a,
        status: st?.status ?? "open",
        agentConversationUrl: st?.agentConversationUrl ?? null,
      };
    });

    return Response.json({
      actions: includeClosed ? merged : merged.filter((a) => a.status === "open"),
      openCount: merged.filter((a) => a.status === "open").length,
      doneCount: merged.filter((a) => a.status === "done").length,
    });
  },
};
