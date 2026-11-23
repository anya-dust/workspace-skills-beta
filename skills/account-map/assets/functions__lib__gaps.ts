// The rules behind the blind-spot engine: which seats a deal needs filled, and how a
// missing seat turns into a suggested person plus a warm path to them.

import { intBetween, pick, rng } from "./synth.ts";

export const CARD_W = 256;
export const CARD_H = 250;

export type Severity = "critical" | "high" | "medium";

export type SeatSpec = {
  key: string;
  label: string;
  /** A deal role from the roles table that must be assigned to somebody. */
  roleName?: string;
  /** Functional coverage: some contact's job title must match this. */
  titlePattern?: RegExp;
  severity: Severity;
  why: string;
  gapTitles: string[];
  /**
   * Who on the map this gap sits under, best match first. A missing seat is not a floating
   * card in a corner: it belongs beside the executive whose org it would report into, so the
   * break in the route is visible where the rep is already looking.
   */
  anchorPatterns?: RegExp[];
};

// Ordered by how much the gap hurts. Two flavours: a deal role nobody holds, and a
// company function nobody on the map represents.
export const SEATS: SeatSpec[] = [
  {
    key: "economic-buyer",
    label: "Economic Buyer",
    roleName: "Economic Buyer",
    severity: "critical",
    why: "Nobody on the map owns the budget, so there is no one to sign.",
    gapTitles: ["VP of Finance, Technology", "SVP Financial Planning", "VP Corporate Finance"],
    anchorPatterns: [/chief financial|\bcfo\b/i, /financ|investor relations|corporate development/i, /co-ceo|chief executive/i],
  },
  {
    key: "security",
    label: "Security & Privacy review",
    titlePattern: /security|privacy|infosec|ciso|trust|\brisk\b|compliance/i,
    severity: "critical",
    why: "Enterprise deals of this size route through a security review. An unmapped reviewer is the most common late-stage stall.",
    gapTitles: ["VP of Information Security", "Director, Security Architecture", "Head of Data Privacy"],
    anchorPatterns: [/security|privacy|infosec|trust/i, /product and technology|chief technolog|\bcto\b/i, /legal|counsel/i],
  },
  {
    key: "exec-champion",
    label: "Executive Champion",
    roleName: "Champion - Executive",
    severity: "high",
    why: "No senior voice is carrying this internally when you are not in the room.",
    gapTitles: ["SVP, Business Operations", "EVP Strategy", "SVP Product Operations"],
    anchorPatterns: [/co-ceo|chief executive/i, /chief operating|chief business|president/i, /chief content|chief marketing/i],
  },
  {
    key: "technical-champion",
    label: "Technical Champion",
    roleName: "Champion - Technical",
    severity: "high",
    why: "No one technical is advocating for the build, so adoption has no owner.",
    gapTitles: ["Director of Platform Engineering", "Head of Developer Experience", "Principal Engineer, Internal Tools"],
    anchorPatterns: [/product and technology|chief technolog|\bcto\b/i, /engineer|platform|developer/i],
  },
  {
    key: "procurement",
    label: "Procurement / Vendor Management",
    titlePattern: /procurement|sourcing|vendor|purchasing|supplier|contracts/i,
    severity: "high",
    why: "Procurement will be inserted at signature time whether you map them now or meet them then.",
    gapTitles: ["Director of Procurement", "Senior Manager, Vendor Management", "Head of Strategic Sourcing"],
    anchorPatterns: [/chief financial|\bcfo\b/i, /legal|counsel|procurement/i, /financ/i],
  },
  {
    key: "it-platform",
    label: "IT & Platform ownership",
    titlePattern: /\bIT\b|workplace technology|infrastructure|devops|platform engineering|enterprise (technology|applications)|internal tools/i,
    severity: "high",
    why: "SSO, provisioning and rollout all land on this team. Without them the deal closes and never deploys.",
    gapTitles: ["VP of IT & Workplace Technology", "Director, Enterprise Applications", "Head of Internal Platform"],
    anchorPatterns: [/\bIT\b|infrastructure|internal tools|workplace technology/i, /product and technology|chief technolog|\bcto\b/i, /engineer|platform/i],
  },
  {
    key: "data-ai",
    label: "Data & AI ownership",
    titlePattern: /\bdata\b|analytics|machine learning|\bAI\b|\bML\b|science/i,
    severity: "medium",
    why: "The data owner decides what this product is allowed to read. They set the ceiling on value.",
    gapTitles: ["Head of AI Platform", "Director of Data Science", "VP Data & Analytics"],
    anchorPatterns: [/\bdata\b|analytics|science|machine learning/i, /product and technology|chief technolog|\bcto\b/i, /advertis/i],
  },
  {
    key: "business-evaluator",
    label: "Business Value Evaluator",
    roleName: "Evaluator - Business Value",
    severity: "medium",
    why: "Nobody is building the internal ROI story, so the business case is yours alone to defend.",
    gapTitles: ["Director, Business Operations", "Head of Strategic Finance", "VP Transformation"],
    anchorPatterns: [/business operations|strateg|transformation/i, /financ|investor relations/i, /chief operating|president/i],
  },
  {
    key: "technical-evaluator",
    label: "Technical Fit Evaluator",
    roleName: "Evaluator - Technical Fit",
    severity: "medium",
    why: "No one is pressure-testing the architecture, which means the objection has not surfaced yet.",
    gapTitles: ["Director of Engineering, Platform", "Staff Architect", "Head of Technical Evaluation"],
    anchorPatterns: [/engineer|platform|architect/i, /product and technology|chief technolog|\bcto\b/i, /\bgames\b|advertis/i],
  },
];

// Synthetic names for the person we think fills an empty seat.
const FIRST = [
  "Rachel", "Marcus", "Priya", "Devon", "Naomi", "Elias", "Sofia", "Aaron", "Yuki", "Camille",
  "Nadia", "Julian", "Simone", "Omar", "Alina", "Theo", "Imani", "Felix", "Renata", "Hugo",
];
const LAST = [
  "Adler", "Okafor", "Ramachandran", "Whitfield", "Castellanos", "Lindqvist", "Moreau", "Bhatt",
  "Nakamura", "Ferreira", "Kowalski", "Ellison", "Abadi", "Sørensen", "Delgado", "Mensah",
];

// The seller side of the room: who can open the door.
const TEAMMATES: { name: string; title: string }[] = [
  { name: "Maya Chen", title: "VP of Sales" },
  { name: "Nic Siegle", title: "Solutions Engineer" },
  { name: "Theo Blanc", title: "Customer Success Manager" },
  { name: "Ines Vidal", title: "Sales Development" },
  { name: "Gabriel Hubert", title: "CEO" },
  { name: "Dora Marques", title: "Account Executive" },
];

const PREV_COMPANIES = [
  "DocuSign", "Snowflake", "Datadog", "Stripe", "Figma", "Databricks", "Atlassian", "Segment",
];
const EVENTS = ["SaaStr Annual", "Web Summit", "Dreamforce", "AI Engineer Summit"];

export type Warm = { via: string; viaTitle: string; detail: string };

export function warmPath(seed: string, personName: string): Warm {
  const r = rng(`warm:${seed}`);
  const mate = pick(r, TEAMMATES);
  const company = pick(r, PREV_COMPANIES);
  const first = personName.split(/\s+/)[0];
  const shapes = [
    `Worked with ${first} at ${company} for ${intBetween(r, 2, 6)} years`,
    `Overlapped at ${company}; ${mate.name.split(" ")[0]} still speaks with ${first} monthly`,
    `Met ${first} at ${pick(r, EVENTS)} and has stayed in touch since`,
    `Second-degree on LinkedIn, ${intBetween(r, 4, 22)} shared connections`,
    `${first} was ${mate.name.split(" ")[0]}'s reference during their ${company} exit`,
  ];
  return { via: mate.name, viaTitle: mate.title, detail: pick(r, shapes) };
}

export function suggestPerson(seed: string, titles: string[]): { name: string; title: string } {
  const r = rng(`person:${seed}`);
  return { name: `${pick(r, FIRST)} ${pick(r, LAST)}`, title: pick(r, titles) };
}

/** Titles a plausible direct report of this leader would carry. */
export function reportTitlesFor(title: string | null | undefined): string[] {
  const t = (title ?? "").toLowerCase();
  if (/financ|cfo/.test(t)) return ["VP Financial Planning & Analysis", "Director, Finance Operations"];
  if (/legal|counsel/.test(t)) return ["Associate General Counsel, Technology", "Director, Commercial Legal"];
  if (/product|technolog|engineer|cto/.test(t)) return ["VP of Platform Engineering", "Director, AI Infrastructure", "Head of Internal Tools"];
  if (/market/.test(t)) return ["VP Marketing Technology", "Director, Marketing Operations"];
  if (/content|film|studio/.test(t)) return ["VP Content Operations", "Director, Production Technology"];
  if (/talent|people|hr/.test(t)) return ["VP People Technology", "Director, Talent Operations"];
  if (/communicat|affairs|polic/.test(t)) return ["VP Corporate Communications", "Director, Policy Research"];
  if (/advertis/.test(t)) return ["VP Ad Platform", "Director, Advertising Operations"];
  if (/partner/.test(t)) return ["Director, Strategic Partnerships", "Head of Partner Operations"];
  if (/game/.test(t)) return ["VP Games Technology", "Director, Live Operations"];
  return ["VP of Business Operations", "Director, Strategy & Operations"];
}

/** Rough seniority read, duplicated here so the gap rules stay self-contained. */
export function isLeader(title: string | null | undefined): boolean {
  return /\b(ceo|co-ceo|chief|cto|cfo|cmo|coo|president|chairman|vp|vice president|svp|evp|head of|global head)\b/i
    .test(title ?? "");
}

type Box = { x: number; y: number };

/**
 * Look for a free slot around the spot we want, spiralling out sideways and then down,
 * so a ghost card stays next to the person it belongs under instead of marching off to
 * the edge of the canvas.
 */
export function findFreeSlot(want: Box, taken: Box[]): Box {
  const pad = 28;
  const dx = CARD_W + pad;
  const dy = CARD_H + pad;
  const offsets: Box[] = [{ x: 0, y: 0 }];
  for (let ring = 1; ring <= 5; ring++) {
    offsets.push({ x: ring * dx, y: 0 });
    offsets.push({ x: -ring * dx, y: 0 });
    offsets.push({ x: (ring - 1) * dx, y: dy });
    offsets.push({ x: -(ring - 1) * dx, y: dy });
    offsets.push({ x: (ring - 1) * dx, y: -dy });
  }
  for (const o of offsets) {
    const spot = { x: want.x + o.x, y: want.y + o.y };
    if (!overlaps(spot, taken)) return spot;
  }
  return { x: want.x, y: want.y + dy * 2 };
}

/** Whether a card at this spot would sit on top of something already on the canvas. */
export function overlaps(spot: Box, taken: Box[]): boolean {
  const pad = 28;
  return taken.some(
    (t) => Math.abs(t.x - spot.x) < CARD_W + pad && Math.abs(t.y - spot.y) < CARD_H + pad,
  );
}

export type AnchorCandidate = {
  id: number;
  jobTitle?: string | null;
  isContacted?: boolean | null;
  posX?: number | null;
  posY?: number | null;
};

/**
 * The contact a missing seat hangs off: the first title pattern that matches somebody on the
 * map, preferring a leader you already talk to. Falls back to the most senior engaged contact
 * so a gap always lands inside the org chart rather than beside it.
 */
export function pickSeatAnchor(
  patterns: RegExp[] | undefined,
  cs: AnchorCandidate[],
): AnchorCandidate | null {
  if (cs.length === 0) return null;
  const rank = (a: AnchorCandidate, b: AnchorCandidate) =>
    (b.isContacted ? 1 : 0) - (a.isContacted ? 1 : 0) ||
    (isLeader(b.jobTitle) ? 1 : 0) - (isLeader(a.jobTitle) ? 1 : 0) ||
    a.id - b.id;
  for (const p of patterns ?? []) {
    const hits = cs.filter((c) => p.test(c.jobTitle ?? ""));
    if (hits.length > 0) return [...hits].sort(rank)[0];
  }
  const leaders = cs.filter((c) => isLeader(c.jobTitle));
  return [...(leaders.length > 0 ? leaders : cs)].sort(rank)[0] ?? null;
}

/** Where a ghost card wants to sit relative to the contact it belongs under. */
export function slotUnder(anchor: AnchorCandidate): Box {
  return { x: (anchor.posX ?? 0) + 40, y: (anchor.posY ?? 0) + CARD_H + 90 };
}

/** How far a stored ghost may drift from its anchor before a rescan pulls it back in. */
export const MAX_DRIFT = 620;
