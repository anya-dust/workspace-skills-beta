import { z } from "zod";
import { db, DB, eq, stickyNotes } from "./lib/store.ts";

export const schema = {
  description: "Delete a sticky note from an account map.",
  input: z.object({ id: z.number() }),
  output: z.object({ ok: z.boolean() }),
};

export default {
  async fetch(request: Request): Promise<Response> {
    const { id } = await request.json();
    db(DB).delete(stickyNotes).where(eq(stickyNotes.id, id)).run();
    return Response.json({ ok: true });
  },
};
