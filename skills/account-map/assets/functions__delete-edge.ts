import { z } from "zod";
import { db, DB, eq, edges } from "./lib/store.ts";

export const schema = {
  description: "Delete an edge between two contacts.",
  input: z.object({ id: z.number() }),
  output: z.object({ ok: z.boolean() }),
};

export default {
  async fetch(request: Request): Promise<Response> {
    const { id } = await request.json();
    db(DB).delete(edges).where(eq(edges.id, id)).run();
    return Response.json({ ok: true });
  },
};
