import { z } from "zod";
import { db, DB, eq, maps, mapZ, listMaps, contacts, edges, stickyNotes } from "./lib/store.ts";
import { snapshotZ } from "./lib/store.ts";

export const schema = {
  description: "Rename, trash, restore, or permanently destroy an account map. Returns the updated maps list.",
  input: z.object({
    mapId: z.number(),
    action: z.enum(["rename", "trash", "restore", "destroy"]),
    name: z.string().optional(),
  }),
  output: z.object({ maps: z.array(mapZ) }),
};

export default {
  async fetch(request: Request): Promise<Response> {
    const { mapId, action, name } = await request.json();
    if (action === "rename" && name) {
      db(DB).update(maps).set({ name }).where(eq(maps.id, mapId)).run();
    } else if (action === "trash") {
      db(DB).update(maps).set({ deletedAt: new Date() }).where(eq(maps.id, mapId)).run();
    } else if (action === "restore") {
      db(DB).update(maps).set({ deletedAt: null }).where(eq(maps.id, mapId)).run();
    } else if (action === "destroy") {
      db(DB).delete(contacts).where(eq(contacts.mapId, mapId)).run();
      db(DB).delete(edges).where(eq(edges.mapId, mapId)).run();
      db(DB).delete(stickyNotes).where(eq(stickyNotes.mapId, mapId)).run();
      db(DB).delete(maps).where(eq(maps.id, mapId)).run();
    }
    return Response.json({ maps: listMaps() });
  },
};
