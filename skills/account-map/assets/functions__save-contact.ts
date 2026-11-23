import { z } from "zod";
import { db, DB, eq, contacts, contactZ, getContact } from "./lib/store.ts";

export const schema = {
  description: "Create or update a contact card on an account map. Pass id to update; omit to create.",
  input: z.object({
    mapId: z.number(),
    id: z.number().optional(),
    name: z.string().optional(),
    jobTitle: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    linkedinUrl: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    customContext: z.string().nullable().optional(),
    isContacted: z.boolean().optional(),
    roleId: z.number().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    crmUrl: z.string().nullable().optional(),
    ownerName: z.string().nullable().optional(),
    lastContactedAt: z.string().nullable().optional(),
    posX: z.number().optional(),
    posY: z.number().optional(),
  }).strict(),
  output: z.object({ contact: contactZ }),
};

export default {
  async fetch(request: Request): Promise<Response> {
    const input = await request.json();
    const { id, mapId, ...fields } = input;
    if (id != null) {
      const set: Record<string, unknown> = { updatedAt: new Date() };
      for (const k of ["name", "jobTitle", "email", "linkedinUrl", "notes", "customContext", "isContacted", "roleId", "avatarUrl", "crmUrl", "ownerName", "lastContactedAt", "posX", "posY"]) {
        if (k in input) set[k] = (input as Record<string, unknown>)[k];
      }
      db(DB).update(contacts).set(set).where(eq(contacts.id, id)).run();
      return Response.json({ contact: getContact(id) });
    }
    const row = db(DB)
      .insert(contacts)
      .values({
        mapId,
        name: fields.name ?? "New Contact",
        jobTitle: fields.jobTitle ?? null,
        email: fields.email ?? null,
        linkedinUrl: fields.linkedinUrl ?? null,
        notes: fields.notes ?? null,
        customContext: fields.customContext ?? null,
        isContacted: fields.isContacted ?? false,
        roleId: fields.roleId ?? null,
        avatarUrl: fields.avatarUrl ?? null,
        crmUrl: fields.crmUrl ?? null,
        ownerName: fields.ownerName ?? null,
        lastContactedAt: fields.lastContactedAt ?? null,
        posX: fields.posX ?? 0,
        posY: fields.posY ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: contacts.id })
      .get();
    return Response.json({ contact: getContact(row.id) });
  },
};
