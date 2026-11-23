import { z } from "zod";
import { db, DB, eq, stickyNotes, noteZ } from "./lib/store.ts";

export const schema = {
  description: "Create or update a sticky note on an account map. Pass id to update; omit to create.",
  input: z.object({
    mapId: z.number(),
    id: z.number().optional(),
    body: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    posX: z.number().optional(),
    posY: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
  output: z.object({ note: noteZ }),
};

const COLS = { id: stickyNotes.id, mapId: stickyNotes.mapId, body: stickyNotes.body, color: stickyNotes.color, posX: stickyNotes.posX, posY: stickyNotes.posY, width: stickyNotes.width, height: stickyNotes.height };

export default {
  async fetch(request: Request): Promise<Response> {
    const input = await request.json();
    const { id, mapId } = input;
    if (id != null) {
      const set: Record<string, unknown> = {};
      for (const k of ["body", "color", "posX", "posY", "width", "height"]) {
        if (k in input) set[k] = (input as Record<string, unknown>)[k];
      }
      if (Object.keys(set).length > 0) db(DB).update(stickyNotes).set(set).where(eq(stickyNotes.id, id)).run();
      const note = db(DB).select(COLS).from(stickyNotes).where(eq(stickyNotes.id, id)).get();
      return Response.json({ note });
    }
    const row = db(DB)
      .insert(stickyNotes)
      .values({
        mapId,
        body: input.body ?? "",
        color: input.color ?? "#fef9c3",
        posX: input.posX ?? 0,
        posY: input.posY ?? 0,
        width: input.width ?? 220,
        height: input.height ?? 140,
        createdAt: new Date(),
      })
      .returning(COLS)
      .get();
    return Response.json({ note: row });
  },
};
