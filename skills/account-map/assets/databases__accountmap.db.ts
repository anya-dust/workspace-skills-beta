// Database: accountmap
// Used by functions: get-map, create-map, update-map, save-contact, delete-contact,
// move-items, save-edge, delete-edge, save-note, delete-note, save-role, delete-role, import-map,
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const maps = sqliteTable("maps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }),
});

export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  color: text("color"),
  sortOrder: integer("sort_order"),
  createdAt: integer("created_at", { mode: "timestamp" }),
});

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mapId: integer("map_id"),
  name: text("name"),
  jobTitle: text("job_title"),
  email: text("email"),
  linkedinUrl: text("linkedin_url"),
  notes: text("notes"),
  // Free-text intel a human typed. Agents must never write this column; see SKILL_REFERENCE.md.
  customContext: text("custom_context"),
  isContacted: integer("is_contacted", { mode: "boolean" }),
  roleId: integer("role_id"),
  avatarUrl: text("avatar_url"),
  // Account-team relationship fields: CRM record,
  // the person on our side who owns the relationship, and the last logged touch (ISO date).
  crmUrl: text("crm_url"),
  ownerName: text("owner_name"),
  lastContactedAt: text("last_contacted_at"),
  posX: real("pos_x"),
  posY: real("pos_y"),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
}, (t) => [index("contacts_map_idx").on(t.mapId)]);

export const edges = sqliteTable("edges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mapId: integer("map_id"),
  sourceId: integer("source_id"),
  targetId: integer("target_id"),
  kind: text("kind"), // 'default' (reporting) | 'influence'
  createdAt: integer("created_at", { mode: "timestamp" }),
}, (t) => [index("edges_map_idx").on(t.mapId)]);

export const stickyNotes = sqliteTable("sticky_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mapId: integer("map_id"),
  body: text("body"),
  color: text("color"),
  posX: real("pos_x"),
  posY: real("pos_y"),
  width: real("width"),
  height: real("height"),
  createdAt: integer("created_at", { mode: "timestamp" }),
}, (t) => [index("sticky_notes_map_idx").on(t.mapId)]);


// A detected gap in the buying committee, rendered on the canvas as a dashed ghost card.
// kind: 'role_coverage' (a committee role nobody fills) | 'org_hole' (a leader whose org
// is unmapped) | 'engagement_decay' (a mapped person who has gone quiet).
// The suggested* columns hold the person we think fills the gap, and warm* the path to them.
export const blindSpots = sqliteTable("blind_spots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mapId: integer("map_id"),
  kind: text("kind"),
  // Stable identity for a computed gap so a rescan updates instead of duplicating.
  signature: text("signature"),
  severity: text("severity"), // 'critical' | 'high' | 'medium'
  gapTitle: text("gap_title"), // the seat that is empty, e.g. "VP of RevOps"
  rationale: text("rationale"),
  anchorContactId: integer("anchor_contact_id"),
  suggestedName: text("suggested_name"),
  suggestedTitle: text("suggested_title"),
  suggestedEmail: text("suggested_email"),
  suggestedLinkedinUrl: text("suggested_linkedin_url"),
  suggestedAvatarUrl: text("suggested_avatar_url"),
  suggestedRoleId: integer("suggested_role_id"),
  warmVia: text("warm_via"), // teammate on our side who can open the door
  warmViaTitle: text("warm_via_title"),
  warmDetail: text("warm_detail"),
  status: text("status"), // 'open' | 'dismissed' | 'resolved'
  resolvedContactId: integer("resolved_contact_id"),
  posX: real("pos_x"),
  posY: real("pos_y"),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
}, (t) => [index("blind_spots_map_idx").on(t.mapId)]);

export const productUsage = sqliteTable("product_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contactId: integer("contact_id"),
  mapId: integer("map_id"),
  seatStatus: text("seat_status"), // 'active' | 'provisioned' | 'churned' | 'none'
  licenseTier: text("license_tier"),
  healthScore: integer("health_score"), // 0-100
  trendPct: real("trend_pct"), // 30d vs previous 30d
  sessions30d: integer("sessions_30d"),
  sessions90d: integer("sessions_90d"),
  minutes30d: integer("minutes_30d"),
  activeDays30d: integer("active_days_30d"),
  actions30d: integer("actions_30d"),
  apiCalls30d: integer("api_calls_30d"),
  seatsManaged: integer("seats_managed"),
  topFeature: text("top_feature"),
  lastSeenAt: text("last_seen_at"),
  firstSeenAt: text("first_seen_at"),
  nps: integer("nps"),
  refreshedAt: integer("refreshed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }),
}, (t) => [index("product_usage_contact_idx").on(t.contactId)]);

// 30-day daily series behind each contact's sparkline and detail chart.
export const usageDaily = sqliteTable("usage_daily", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contactId: integer("contact_id"),
  mapId: integer("map_id"),
  day: text("day"), // ISO yyyy-mm-dd
  sessions: integer("sessions"),
  minutes: integer("minutes"),
  createdAt: integer("created_at", { mode: "timestamp" }),
}, (t) => [index("usage_daily_contact_idx").on(t.contactId)]);

// Per-contact feature adoption breakdown.
export const featureUsage = sqliteTable("feature_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contactId: integer("contact_id"),
  mapId: integer("map_id"),
  feature: text("feature"),
  uses30d: integer("uses_30d"),
  adoptionPct: integer("adoption_pct"),
  createdAt: integer("created_at", { mode: "timestamp" }),
}, (t) => [index("feature_usage_contact_idx").on(t.contactId)]);

// Account-level rollup shown in the top bar.
export const accountUsage = sqliteTable("account_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mapId: integer("map_id"),
  seatsLicensed: integer("seats_licensed"),
  seatsActive: integer("seats_active"),
  wau: integer("wau"),
  mau: integer("mau"),
  healthScore: integer("health_score"),
  trendPct: real("trend_pct"),
  arr: integer("arr"),
  renewalDate: text("renewal_date"),
  openTickets: integer("open_tickets"),
  csat: real("csat"),
  topFeature: text("top_feature"),
  refreshedAt: integer("refreshed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }),
}, (t) => [index("account_usage_map_idx").on(t.mapId)]);

// Monthly account trend behind the header chart.
export const accountUsageMonthly = sqliteTable("account_usage_monthly", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mapId: integer("map_id"),
  month: text("month"), // yyyy-mm
  activeUsers: integer("active_users"),
  sessions: integer("sessions"),
  seatsLicensed: integer("seats_licensed"),
  createdAt: integer("created_at", { mode: "timestamp" }),
}, (t) => [index("account_usage_monthly_map_idx").on(t.mapId)]);

// Per-action queue state. Actions themselves are derived from the map on every read, so
// only the rep's decision about them is stored, keyed by a stable action key.
export const actionState = sqliteTable("action_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mapId: integer("map_id"),
  actionKey: text("action_key"),
  status: text("status"), // 'open' | 'done' | 'snoozed'
  snoozedUntil: text("snoozed_until"),
  userId: text("user_id"),
  agentConversationUrl: text("agent_conversation_url"),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }),
}, (t) => [index("action_state_map_idx").on(t.mapId)]);

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key"),
  value: text("value"),
  createdAt: integer("created_at", { mode: "timestamp" }),
});
