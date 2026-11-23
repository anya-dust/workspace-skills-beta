import { z } from "zod";
import { db, DB, eq, roles, roleZ, listRoles, contacts } from "./lib/store.ts";

export const schema = {
  description: "Delete a deal role. Contacts assigned to it fall back to 'No Role Assigned'. Returns the full roles list.",
  input: z.object({ id: z.number() }),
  output: z.object({ roles: z.array(roleZ) }),
};

export default {
  async fetch(request: Request): Promise<Response> {
    const { id } = await request.json();
    db(DB).update(contacts).set({ roleId: null }).where(eq(contacts.roleId, id)).run();
    db(DB).delete(roles).where(eq(roles.id, id)).run();
    return Response.json({ roles: listRoles() });
  },
};
