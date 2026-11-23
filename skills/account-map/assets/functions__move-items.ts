import { z } from "zod";
import { blindSpots, db, DB, eq, contacts, stickyNotes } from "./lib/store.ts";

export const schema = {
  description: "Batch-save canvas positions for contacts, sticky notes and blind-spot ghost cards after dragging.",
  input: z.object({
    contacts: z.array(z.object({ id: z.number(), x: z.number(), y: z.number() })).optional(),
    notes: z.array(z.object({ id: z.number(), x: z.number(), y: z.number() })).optional(),
    blindSpots: z.array(z.object({ id: z.number(), x: z.number(), y: z.number() })).optional(),
  }),
  output: z.object({ ok: z.boolean() }),
};

export default {
  async fetch(request: Request): Promise<Response> {
    const { contacts: cs, notes: ns, blindSpots: bs } = await request.json();
    for (const b of bs ?? []) {
      db(DB).update(blindSpots).set({ posX: b.x, posY: b.y, updatedAt: new Date() }).where(eq(blindSpots.id, b.id)).run();
    }
    for (const c of cs ?? []) {
      db(DB).update(contacts).set({ posX: c.x, posY: c.y, updatedAt: new Date() }).where(eq(contacts.id, c.id)).run();
    }
    for (const n of ns ?? []) {
      db(DB).update(stickyNotes).set({ posX: n.x, posY: n.y }).where(eq(stickyNotes.id, n.id)).run();
    }
    return Response.json({ ok: true });
  },
};
