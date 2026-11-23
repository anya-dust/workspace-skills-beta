import { z } from "zod";
import { db, DB, eq, roles, roleZ, listRoles, seedRolesIfEmpty } from "./lib/store.ts";

export const schema = {
  description: "Create or update a deal role (name + color). Returns the full roles list.",
  input: z.object({
    id: z.number().optional(),
    name: z.string().min(1),
    color: z.string().min(1),
  }),
  output: z.object({ roles: z.array(roleZ) }),
};

export default {
  async fetch(request: Request): Promise<Response> {
    const { id, name, color } = await request.json();
    seedRolesIfEmpty();
    if (id != null) {
      db(DB).update(roles).set({ name, color }).where(eq(roles.id, id)).run();
    } else {
      const max = listRoles().reduce((m, r) => Math.max(m, r.sortOrder ?? 0), 0);
      db(DB).insert(roles).values({ name, color, sortOrder: max + 1, createdAt: new Date() }).run();
    }
    return Response.json({ roles: listRoles() });
  },
};
