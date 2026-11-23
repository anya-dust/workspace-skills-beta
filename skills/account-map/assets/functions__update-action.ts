// Database: accountmap
import { z } from "zod";
import { and } from "drizzle-orm";
import { currentUser } from "@dust/pod";
import { actionState, db, DB, eq } from "./lib/store.ts";

export const schema = {
  description:
    "Mark a next-best-action as done, snoozed, or open again, and optionally record the agent conversation opened for it. Upserts on the action key, so repeating the call is safe.",
  userIdentity: "workspace_user_required",
  input: z.object({
    mapId: z.number(),
    actionKey: z.string(),
    status: z.enum(["open", "done", "snoozed"]),
    agentConversationUrl: z.string().nullable().optional(),
  }).strict(),
  output: z.object({ actionKey: z.string(), status: z.string() }),
};

export default {
  async fetch(request: Request): Promise<Response> {
    const { mapId, actionKey, status, agentConversationUrl } = await request.json();
    const user = currentUser();
    const now = new Date();

    const existing = db(DB).select({ id: actionState.id }).from(actionState)
      .where(and(eq(actionState.mapId, mapId), eq(actionState.actionKey, actionKey))).get();

    if (existing) {
      const patch: Record<string, unknown> = { status, updatedAt: now, userId: user?.sId ?? null };
      // Only overwrite the conversation link when a new one is supplied; marking an action
      // done later must not erase the thread it was handled in.
      if (agentConversationUrl !== undefined && agentConversationUrl !== null) {
        patch.agentConversationUrl = agentConversationUrl;
      }
      db(DB).update(actionState).set(patch).where(eq(actionState.id, existing.id)).run();
    } else {
      db(DB).insert(actionState).values({
        mapId, actionKey, status,
        snoozedUntil: null,
        userId: user?.sId ?? null,
        agentConversationUrl: agentConversationUrl ?? null,
        updatedAt: now, createdAt: now,
      }).run();
    }

    return Response.json({ actionKey, status });
  },
};
