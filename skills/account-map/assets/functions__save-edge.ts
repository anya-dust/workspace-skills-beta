import { z } from "zod";
import { db, DB, eq, edges, edgeZ } from "./lib/store.ts";

export const schema = {
  description: "Create a reporting ('default') or 'influence' edge between two contacts on a map. Duplicate source/target pairs are reused.",
  input: z.object({
    mapId: z.number(),
    sourceId: z.number(),
    targetId: z.number(),
    kind: z.enum(["default", "influence"]).optional(),
  }),
  output: z.object({ edge: edgeZ }),
};

export default {
  async fetch(request: Request): Promise<Response> {
    const { mapId, sourceId, targetId, kind } = await request.json();
    const existing = db(DB)
      .select({ id: edges.id, mapId: edges.mapId, sourceId: edges.sourceId, targetId: edges.targetId, kind: edges.kind })
      .from(edges)
      .where(eq(edges.mapId, mapId))
      .all()
      .find((e) => e.sourceId === sourceId && e.targetId === targetId);
    if (existing) return Response.json({ edge: existing });
    const row = db(DB)
      .insert(edges)
      .values({ mapId, sourceId, targetId, kind: kind ?? "default", createdAt: new Date() })
      .returning({ id: edges.id, mapId: edges.mapId, sourceId: edges.sourceId, targetId: edges.targetId, kind: edges.kind })
      .get();
    return Response.json({ edge: row });
  },
};
