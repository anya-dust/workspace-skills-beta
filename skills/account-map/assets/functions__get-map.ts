import { z } from "zod";
import { snapshot, snapshotZ } from "./lib/store.ts";

export const schema = {
  description: "Return the full snapshot of an account map (maps list, roles, contacts, edges, sticky notes). Omit mapId for the first active map.",
  input: z.object({ mapId: z.number().optional() }),
  output: snapshotZ,
};

export default {
  async fetch(request: Request): Promise<Response> {
    const { mapId } = await request.json();
    return Response.json(snapshot(mapId));
  },
};
