import { z } from "zod";
import { asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@dust/pod";
import {
  accountUsage, accountUsageMonthly, actionState, blindSpots, contacts, edges, featureUsage, maps,
  productUsage, roles, stickyNotes, usageDaily,
} from "../../databases/accountmap.db.ts";

export const DB = "accountmap";

export const mapZ = z.object({
  id: z.number(),
  name: z.string().nullable(),
  deleted: z.boolean(),
});
export const roleZ = z.object({
  id: z.number(),
  name: z.string().nullable(),
  color: z.string().nullable(),
  sortOrder: z.number().nullable(),
});
export const contactZ = z.object({
  id: z.number(),
  mapId: z.number().nullable(),
  name: z.string().nullable(),
  jobTitle: z.string().nullable(),
  email: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  notes: z.string().nullable(),
  customContext: z.string().nullable(),
  isContacted: z.boolean().nullable(),
  roleId: z.number().nullable(),
  avatarUrl: z.string().nullable(),
  crmUrl: z.string().nullable(),
  ownerName: z.string().nullable(),
  lastContactedAt: z.string().nullable(),
  posX: z.number().nullable(),
  posY: z.number().nullable(),
});
export const edgeZ = z.object({
  id: z.number(),
  mapId: z.number().nullable(),
  sourceId: z.number().nullable(),
  targetId: z.number().nullable(),
  kind: z.string().nullable(),
});
export const noteZ = z.object({
  id: z.number(),
  mapId: z.number().nullable(),
  body: z.string().nullable(),
  color: z.string().nullable(),
  posX: z.number().nullable(),
  posY: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
});
export const blindSpotZ = z.object({
  id: z.number(),
  mapId: z.number().nullable(),
  kind: z.string().nullable(),
  signature: z.string().nullable(),
  severity: z.string().nullable(),
  gapTitle: z.string().nullable(),
  rationale: z.string().nullable(),
  anchorContactId: z.number().nullable(),
  suggestedName: z.string().nullable(),
  suggestedTitle: z.string().nullable(),
  suggestedEmail: z.string().nullable(),
  suggestedLinkedinUrl: z.string().nullable(),
  suggestedAvatarUrl: z.string().nullable(),
  suggestedRoleId: z.number().nullable(),
  warmVia: z.string().nullable(),
  warmViaTitle: z.string().nullable(),
  warmDetail: z.string().nullable(),
  status: z.string().nullable(),
  resolvedContactId: z.number().nullable(),
  posX: z.number().nullable(),
  posY: z.number().nullable(),
});
export const productUsageZ = z.object({
  contactId: z.number().nullable(),
  seatStatus: z.string().nullable(),
  licenseTier: z.string().nullable(),
  healthScore: z.number().nullable(),
  trendPct: z.number().nullable(),
  sessions30d: z.number().nullable(),
  sessions90d: z.number().nullable(),
  minutes30d: z.number().nullable(),
  activeDays30d: z.number().nullable(),
  actions30d: z.number().nullable(),
  apiCalls30d: z.number().nullable(),
  seatsManaged: z.number().nullable(),
  topFeature: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  firstSeenAt: z.string().nullable(),
  nps: z.number().nullable(),
});
export const usageDailyZ = z.object({
  contactId: z.number().nullable(),
  day: z.string().nullable(),
  sessions: z.number().nullable(),
  minutes: z.number().nullable(),
});
export const featureUsageZ = z.object({
  contactId: z.number().nullable(),
  feature: z.string().nullable(),
  uses30d: z.number().nullable(),
  adoptionPct: z.number().nullable(),
});
export const accountUsageZ = z.object({
  mapId: z.number().nullable(),
  seatsLicensed: z.number().nullable(),
  seatsActive: z.number().nullable(),
  wau: z.number().nullable(),
  mau: z.number().nullable(),
  healthScore: z.number().nullable(),
  trendPct: z.number().nullable(),
  arr: z.number().nullable(),
  renewalDate: z.string().nullable(),
  openTickets: z.number().nullable(),
  csat: z.number().nullable(),
  topFeature: z.string().nullable(),
});
export const accountMonthZ = z.object({
  month: z.string().nullable(),
  activeUsers: z.number().nullable(),
  sessions: z.number().nullable(),
  seatsLicensed: z.number().nullable(),
});
export const snapshotZ = z.object({
  maps: z.array(mapZ),
  map: mapZ.nullable(),
  roles: z.array(roleZ),
  contacts: z.array(contactZ),
  edges: z.array(edgeZ),
  notes: z.array(noteZ),
  blindSpots: z.array(blindSpotZ),
  productUsage: z.array(productUsageZ),
  usageDaily: z.array(usageDailyZ),
  featureUsage: z.array(featureUsageZ),
  accountUsage: accountUsageZ.nullable(),
  accountMonthly: z.array(accountMonthZ),
});
export type Snapshot = z.infer<typeof snapshotZ>;

const DEFAULT_ROLES: { name: string; color: string }[] = [
  { name: "Builder", color: "#15803d" },
  { name: "Champion - Business", color: "#eab308" },
  { name: "Champion - Executive", color: "#7c3aed" },
  { name: "Champion - Technical", color: "#fdba74" },
  { name: "Economic Buyer", color: "#bbf7d0" },
  { name: "Evaluator - Business Value", color: "#7dd3fc" },
  { name: "Evaluator - Technical Fit", color: "#f9a8d4" },
  { name: "Super User", color: "#2dd4bf" },
  { name: "Target to Engage", color: "#ef4444" },
  { name: "Weak User", color: "#d1fae5" },
];

export function seedRolesIfEmpty(): void {
  const existing = db(DB).select({ id: roles.id }).from(roles).limit(1).all();
  if (existing.length > 0) return;
  DEFAULT_ROLES.forEach((r, i) => {
    db(DB)
      .insert(roles)
      .values({ name: r.name, color: r.color, sortOrder: i, createdAt: new Date() })
      .run();
  });
}

export function listMaps() {
  const rows = db(DB)
    .select({ id: maps.id, name: maps.name, deletedAt: maps.deletedAt })
    .from(maps)
    .orderBy(asc(maps.id))
    .all();
  return rows.map((m) => ({ id: m.id, name: m.name, deleted: m.deletedAt != null }));
}

export function listRoles() {
  return db(DB)
    .select({ id: roles.id, name: roles.name, color: roles.color, sortOrder: roles.sortOrder })
    .from(roles)
    .orderBy(asc(roles.sortOrder), asc(roles.name))
    .all();
}


const BLIND_SPOT_COLS = {
  id: blindSpots.id, mapId: blindSpots.mapId, kind: blindSpots.kind, signature: blindSpots.signature,
  severity: blindSpots.severity, gapTitle: blindSpots.gapTitle, rationale: blindSpots.rationale,
  anchorContactId: blindSpots.anchorContactId, suggestedName: blindSpots.suggestedName,
  suggestedTitle: blindSpots.suggestedTitle, suggestedEmail: blindSpots.suggestedEmail,
  suggestedLinkedinUrl: blindSpots.suggestedLinkedinUrl, suggestedAvatarUrl: blindSpots.suggestedAvatarUrl,
  suggestedRoleId: blindSpots.suggestedRoleId, warmVia: blindSpots.warmVia,
  warmViaTitle: blindSpots.warmViaTitle, warmDetail: blindSpots.warmDetail, status: blindSpots.status,
  resolvedContactId: blindSpots.resolvedContactId, posX: blindSpots.posX, posY: blindSpots.posY,
};

export function listBlindSpots(mapId: number) {
  return db(DB).select(BLIND_SPOT_COLS).from(blindSpots)
    .where(eq(blindSpots.mapId, mapId)).orderBy(asc(blindSpots.id)).all();
}

export function getBlindSpot(id: number) {
  return db(DB).select(BLIND_SPOT_COLS).from(blindSpots).where(eq(blindSpots.id, id)).get();
}

export function listProductUsage(mapId: number) {
  return db(DB).select({
    contactId: productUsage.contactId, seatStatus: productUsage.seatStatus,
    licenseTier: productUsage.licenseTier, healthScore: productUsage.healthScore,
    trendPct: productUsage.trendPct, sessions30d: productUsage.sessions30d,
    sessions90d: productUsage.sessions90d, minutes30d: productUsage.minutes30d,
    activeDays30d: productUsage.activeDays30d, actions30d: productUsage.actions30d,
    apiCalls30d: productUsage.apiCalls30d, seatsManaged: productUsage.seatsManaged,
    topFeature: productUsage.topFeature, lastSeenAt: productUsage.lastSeenAt,
    firstSeenAt: productUsage.firstSeenAt, nps: productUsage.nps,
  }).from(productUsage).where(eq(productUsage.mapId, mapId)).orderBy(asc(productUsage.contactId)).all();
}

export function listUsageDaily(mapId: number) {
  return db(DB).select({
    contactId: usageDaily.contactId, day: usageDaily.day,
    sessions: usageDaily.sessions, minutes: usageDaily.minutes,
  }).from(usageDaily).where(eq(usageDaily.mapId, mapId)).orderBy(asc(usageDaily.day)).all();
}

export function listFeatureUsage(mapId: number) {
  return db(DB).select({
    contactId: featureUsage.contactId, feature: featureUsage.feature,
    uses30d: featureUsage.uses30d, adoptionPct: featureUsage.adoptionPct,
  }).from(featureUsage).where(eq(featureUsage.mapId, mapId)).orderBy(desc(featureUsage.uses30d)).all();
}

export function getAccountUsage(mapId: number) {
  return db(DB).select({
    mapId: accountUsage.mapId, seatsLicensed: accountUsage.seatsLicensed,
    seatsActive: accountUsage.seatsActive, wau: accountUsage.wau, mau: accountUsage.mau,
    healthScore: accountUsage.healthScore, trendPct: accountUsage.trendPct, arr: accountUsage.arr,
    renewalDate: accountUsage.renewalDate, openTickets: accountUsage.openTickets,
    csat: accountUsage.csat, topFeature: accountUsage.topFeature,
  }).from(accountUsage).where(eq(accountUsage.mapId, mapId)).orderBy(desc(accountUsage.id)).get() ?? null;
}

export function listAccountMonthly(mapId: number) {
  return db(DB).select({
    month: accountUsageMonthly.month, activeUsers: accountUsageMonthly.activeUsers,
    sessions: accountUsageMonthly.sessions, seatsLicensed: accountUsageMonthly.seatsLicensed,
  }).from(accountUsageMonthly).where(eq(accountUsageMonthly.mapId, mapId))
    .orderBy(asc(accountUsageMonthly.month)).all();
}

export function getContact(id: number) {
  return db(DB)
    .select({
      id: contacts.id, mapId: contacts.mapId, name: contacts.name, jobTitle: contacts.jobTitle,
      email: contacts.email, linkedinUrl: contacts.linkedinUrl, notes: contacts.notes,
      customContext: contacts.customContext,
      isContacted: contacts.isContacted, roleId: contacts.roleId, avatarUrl: contacts.avatarUrl,
      crmUrl: contacts.crmUrl, ownerName: contacts.ownerName, lastContactedAt: contacts.lastContactedAt,
      posX: contacts.posX, posY: contacts.posY,
    })
    .from(contacts)
    .where(eq(contacts.id, id))
    .get();
}

export function snapshot(mapId?: number): Snapshot {
  seedRolesIfEmpty();
  const allMaps = listMaps();
  const active = allMaps.filter((m) => !m.deleted);
  let map = null as Snapshot["map"];
  if (mapId != null) {
    map = allMaps.find((m) => m.id === mapId) ?? null;
  }
  if (!map && active.length > 0) map = active[0];

  const empty = { contacts: [], edges: [], notes: [] };
  const emptyExtras = {
    blindSpots: [], productUsage: [], usageDaily: [], featureUsage: [],
    accountUsage: null, accountMonthly: [],
  };
  if (!map) {
    return {
      maps: allMaps, map: null, roles: listRoles(), ...empty,
      ...emptyExtras,
    };
  }
  const mid = map.id;
  const contactRows = db(DB)
    .select({
      id: contacts.id, mapId: contacts.mapId, name: contacts.name, jobTitle: contacts.jobTitle,
      email: contacts.email, linkedinUrl: contacts.linkedinUrl, notes: contacts.notes,
      customContext: contacts.customContext,
      isContacted: contacts.isContacted, roleId: contacts.roleId, avatarUrl: contacts.avatarUrl,
      crmUrl: contacts.crmUrl, ownerName: contacts.ownerName, lastContactedAt: contacts.lastContactedAt,
      posX: contacts.posX, posY: contacts.posY,
    })
    .from(contacts)
    .where(eq(contacts.mapId, mid))
    .orderBy(asc(contacts.id))
    .all();
  const edgeRows = db(DB)
    .select({ id: edges.id, mapId: edges.mapId, sourceId: edges.sourceId, targetId: edges.targetId, kind: edges.kind })
    .from(edges)
    .where(eq(edges.mapId, mid))
    .orderBy(asc(edges.id))
    .all();
  const noteRows = db(DB)
    .select({
      id: stickyNotes.id, mapId: stickyNotes.mapId, body: stickyNotes.body, color: stickyNotes.color,
      posX: stickyNotes.posX, posY: stickyNotes.posY, width: stickyNotes.width, height: stickyNotes.height,
    })
    .from(stickyNotes)
    .where(eq(stickyNotes.mapId, mid))
    .orderBy(asc(stickyNotes.id))
    .all();
  return {
    maps: allMaps, map, roles: listRoles(), contacts: contactRows, edges: edgeRows, notes: noteRows,
    // Blind spots and product usage are both map-scoped and small (tens of rows, plus a
    // 30-day series), so they ship inside the one snapshot the Frame already polls rather
    // than adding a per-card round trip.
    blindSpots: listBlindSpots(mid),
    productUsage: listProductUsage(mid),
    usageDaily: listUsageDaily(mid),
    featureUsage: listFeatureUsage(mid),
    accountUsage: getAccountUsage(mid),
    accountMonthly: listAccountMonthly(mid),
  };
}

export function deleteContactAndEdges(id: number): number[] {
  const touching = db(DB)
    .select({ id: edges.id, sourceId: edges.sourceId, targetId: edges.targetId })
    .from(edges)
    .all()
    .filter((e) => e.sourceId === id || e.targetId === id)
    .map((e) => e.id);
  if (touching.length > 0) {
    db(DB).delete(edges).where(inArray(edges.id, touching)).run();
  }
  db(DB).delete(contacts).where(eq(contacts.id, id)).run();
  return touching;
}

export {
  accountUsage, accountUsageMonthly, actionState, blindSpots, contacts, edges, featureUsage, maps,
  productUsage, roles, stickyNotes, usageDaily, db, eq, inArray, isNull, asc, desc,
};
