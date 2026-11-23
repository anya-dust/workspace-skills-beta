export type MapInfo = { id: number; name: string | null; deleted: boolean };
export type Role = { id: number; name: string | null; color: string | null; sortOrder: number | null };
export type Contact = {
  id: number;
  mapId: number | null;
  name: string | null;
  jobTitle: string | null;
  email: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  /** Human-written intel. Never populated by agents. */
  customContext: string | null;
  isContacted: boolean | null;
  roleId: number | null;
  avatarUrl: string | null;
  crmUrl: string | null;
  ownerName: string | null;
  lastContactedAt: string | null;
  posX: number | null;
  posY: number | null;
};
export type EdgeT = {
  id: number;
  mapId: number | null;
  sourceId: number | null;
  targetId: number | null;
  kind: string | null;
};
export type NoteT = {
  id: number;
  mapId: number | null;
  body: string | null;
  color: string | null;
  posX: number | null;
  posY: number | null;
  width: number | null;
  height: number | null;
};
export type BlindSpotKind = "role_coverage" | "function_coverage" | "org_hole" | "engagement_decay";
export type BlindSpotSeverity = "critical" | "high" | "medium";

export type BlindSpot = {
  id: number;
  mapId: number | null;
  kind: string | null;
  signature: string | null;
  severity: string | null;
  gapTitle: string | null;
  rationale: string | null;
  anchorContactId: number | null;
  suggestedName: string | null;
  suggestedTitle: string | null;
  suggestedEmail: string | null;
  suggestedLinkedinUrl: string | null;
  suggestedAvatarUrl: string | null;
  suggestedRoleId: number | null;
  warmVia: string | null;
  warmViaTitle: string | null;
  warmDetail: string | null;
  status: string | null;
  resolvedContactId: number | null;
  posX: number | null;
  posY: number | null;
};

export type ProductUsage = {
  contactId: number | null;
  seatStatus: string | null;
  licenseTier: string | null;
  healthScore: number | null;
  trendPct: number | null;
  sessions30d: number | null;
  sessions90d: number | null;
  minutes30d: number | null;
  activeDays30d: number | null;
  actions30d: number | null;
  apiCalls30d: number | null;
  seatsManaged: number | null;
  topFeature: string | null;
  lastSeenAt: string | null;
  firstSeenAt: string | null;
  nps: number | null;
};
export type UsageDay = { contactId: number | null; day: string | null; sessions: number | null; minutes: number | null };
export type FeatureUse = { contactId: number | null; feature: string | null; uses30d: number | null; adoptionPct: number | null };
export type AccountUsage = {
  mapId: number | null;
  seatsLicensed: number | null;
  seatsActive: number | null;
  wau: number | null;
  mau: number | null;
  healthScore: number | null;
  trendPct: number | null;
  arr: number | null;
  renewalDate: string | null;
  openTickets: number | null;
  csat: number | null;
  topFeature: string | null;
};
export type AccountMonth = { month: string | null; activeUsers: number | null; sessions: number | null; seatsLicensed: number | null };

export type Snapshot = {
  maps: MapInfo[];
  map: MapInfo | null;
  roles: Role[];
  contacts: Contact[];
  edges: EdgeT[];
  notes: NoteT[];
  blindSpots: BlindSpot[];
  productUsage: ProductUsage[];
  usageDaily: UsageDay[];
  featureUsage: FeatureUse[];
  accountUsage: AccountUsage | null;
  accountMonthly: AccountMonth[];
};

export const CARD_W = 256;
export const NO_ROLE_COLOR = "#e5e7eb";
export const DUST_LOGO = "https://dust.tt/static/landing/logos/dust/Dust_LogoSquare.png";
export const DUST_LOGO_WHITE = "https://dust.tt/static/landing/logos/dust/Dust_LogoSquare_White.png";
export const DUST_LOGO_GRAY = "https://dust.tt/static/landing/logos/dust/Dust_LogoSquare_Gray.png";


export const ACCENT = "#6b46f5";

// ---------- blind spots ----------
export const SEVERITY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
};
export const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
};
export const KIND_LABEL: Record<string, string> = {
  role_coverage: "Committee seat",
  function_coverage: "Function unmapped",
  org_hole: "Org hole",
  engagement_decay: "Going cold",
};

export function severityColor(sev: string | null | undefined): string {
  return SEVERITY_COLOR[sev ?? ""] ?? "#dc2626";
}

/** A spot with a canvas position renders as a ghost card; the rest hang off a contact card. */
export function isGhost(b: BlindSpot): boolean {
  return b.status === "open" && b.posX != null && b.posY != null;
}

export const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2 };
export function bySeverity(a: BlindSpot, b: BlindSpot): number {
  return (SEVERITY_RANK[a.severity ?? ""] ?? 9) - (SEVERITY_RANK[b.severity ?? ""] ?? 9);
}

// ---------- product usage ----------
export const SEAT_LABEL: Record<string, string> = {
  active: "Active seat",
  provisioned: "Seat provisioned, unused",
  churned: "Seat went inactive",
  none: "No seat",
};

export function healthColor(score: number | null | undefined): string {
  const s = score ?? 0;
  if (s >= 70) return "#059669";
  if (s >= 45) return "#ca8a04";
  if (s > 0) return "#dc2626";
  return "#94a3b8";
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function compactNumber(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return `${v}`;
}

export function signedPct(n: number | null | undefined): string {
  const v = Math.round(n ?? 0);
  return `${v > 0 ? "+" : ""}${v}%`;
}

/** Group rows by contact id, preserving input order within each bucket. */
export function groupByContact<T extends { contactId: number | null }>(rows: T[]): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const row of rows) {
    if (row.contactId == null) continue;
    const list = out.get(row.contactId);
    if (list) list.push(row);
    else out.set(row.contactId, [row]);
  }
  return out;
}

/** Inline SVG sparkline path for a small series; returns null when there is nothing to draw. */
export function sparklinePath(values: number[], w: number, h: number): string | null {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = w / (values.length - 1);
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(h - (v / max) * h).toFixed(1)}`)
    .join(" ");
}


/** "3d ago" style relative label; returns null when there is nothing to show. */
export function relativeDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(`${iso}T00:00:00Z`).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export function roleColor(role: Role | undefined | null): string {
  return role?.color || NO_ROLE_COLOR;
}

// 20% tint of a hex color over white for card backgrounds
export function tint(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * alpha + 255 * (1 - alpha));
  const g = Math.round(((n >> 8) & 255) * alpha + 255 * (1 - alpha));
  const b = Math.round((n & 255) * alpha + 255 * (1 - alpha));
  return `rgb(${r}, ${g}, ${b})`;
}

export function isDark(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}
