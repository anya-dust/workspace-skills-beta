import { z } from "zod";
import { deleteContactAndEdges } from "./lib/store.ts";

export const schema = {
  description: "Delete a contact from an account map, along with any edges attached to it.",
  input: z.object({ id: z.number() }),
  output: z.object({ ok: z.boolean(), deletedEdgeIds: z.array(z.number()) }),
};

export default {
  async fetch(request: Request): Promise<Response> {
    const { id } = await request.json();
    const deletedEdgeIds = deleteContactAndEdges(id);
    return Response.json({ ok: true, deletedEdgeIds });
  },
};
