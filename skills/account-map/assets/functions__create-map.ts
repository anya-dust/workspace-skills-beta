import { z } from "zod";
import { db, DB, maps, snapshot, snapshotZ } from "./lib/store.ts";

export const schema = {
  description: "Create a new account map and return its snapshot.",
  input: z.object({ name: z.string().min(1) }),
  output: snapshotZ,
};

export default {
  async fetch(request: Request): Promise<Response> {
    const { name } = await request.json();
    const row = db(DB).insert(maps).values({ name, createdAt: new Date() }).returning({ id: maps.id }).get();
    return Response.json(snapshot(row.id));
  },
};
