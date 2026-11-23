import { z } from "zod";
import { db, DB, maps, contacts, edges, stickyNotes, snapshot, snapshotZ, listRoles, seedRolesIfEmpty } from "./lib/store.ts";

export const schema = {
  description: "Create a map from imported data (JSON export, CSV rows, or agent-built org data). Contacts use a client-side 'ref' key to wire edges. Role is matched by roleName (case-insensitive). Set mapId to import into an existing map instead of creating one.",
  input: z.object({
    name: z.string().min(1),
    mapId: z.number().optional(),
    contacts: z.array(z.object({
      ref: z.string(),
      name: z.string(),
      jobTitle: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      linkedinUrl: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      customContext: z.string().nullable().optional(),
      roleName: z.string().nullable().optional(),
      avatarUrl: z.string().nullable().optional(),
      crmUrl: z.string().nullable().optional(),
      ownerName: z.string().nullable().optional(),
      lastContactedAt: z.string().nullable().optional(),
      isContacted: z.boolean().optional(),
      posX: z.number().optional(),
      posY: z.number().optional(),
    })),
    edges: z.array(z.object({
      sourceRef: z.string(),
      targetRef: z.string(),
      kind: z.enum(["default", "influence"]).optional(),
    })).optional(),
    notes: z.array(z.object({
      body: z.string(),
      color: z.string().optional(),
      posX: z.number().optional(),
      posY: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    })).optional(),
  }),
  output: snapshotZ,
};

export default {
  async fetch(request: Request): Promise<Response> {
    const input = await request.json();
    seedRolesIfEmpty();
    let mapId: number = input.mapId;
    if (mapId == null) {
      const row = db(DB).insert(maps).values({ name: input.name, createdAt: new Date() }).returning({ id: maps.id }).get();
      mapId = row.id;
    }
    const roleByName = new Map(listRoles().map((r) => [String(r.name).toLowerCase(), r.id]));
    const idByRef = new Map<string, number>();
    for (const c of input.contacts) {
      const row = db(DB)
        .insert(contacts)
        .values({
          mapId,
          name: c.name,
          jobTitle: c.jobTitle ?? null,
          email: c.email ?? null,
          linkedinUrl: c.linkedinUrl ?? null,
          notes: c.notes ?? null,
          customContext: c.customContext ?? null,
          isContacted: c.isContacted ?? false,
          roleId: c.roleName ? roleByName.get(c.roleName.toLowerCase()) ?? null : null,
          avatarUrl: c.avatarUrl ?? null,
          crmUrl: c.crmUrl ?? null,
          ownerName: c.ownerName ?? null,
          lastContactedAt: c.lastContactedAt ?? null,
          posX: c.posX ?? 0,
          posY: c.posY ?? 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: contacts.id })
        .get();
      idByRef.set(c.ref, row.id);
    }
    for (const e of input.edges ?? []) {
      const s = idByRef.get(e.sourceRef);
      const t = idByRef.get(e.targetRef);
      if (s == null || t == null) continue;
      db(DB).insert(edges).values({ mapId, sourceId: s, targetId: t, kind: e.kind ?? "default", createdAt: new Date() }).run();
    }
    for (const n of input.notes ?? []) {
      db(DB).insert(stickyNotes).values({
        mapId, body: n.body, color: n.color ?? "#fef9c3",
        posX: n.posX ?? 0, posY: n.posY ?? 0, width: n.width ?? 220, height: n.height ?? 140,
        createdAt: new Date(),
      }).run();
    }
    return Response.json(snapshot(mapId));
  },
};
