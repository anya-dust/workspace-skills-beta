// Deterministic synthetic-data helpers for the demo map. Everything derives from a string
// seed, so re-running the seeder produces the same numbers instead of reshuffling the demo
// between takes.

/** FNV-1a, so a name or an id maps to a stable 32-bit seed. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, and stable across runs. */
export function rng(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(r: () => number, items: readonly T[]): T {
  return items[Math.floor(r() * items.length) % items.length];
}

export function intBetween(r: () => number, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "Acme Corp" -> "acmecorp.com"; keeps an explicit domain untouched. */
export function domainForCompany(name: string | null | undefined): string {
  const raw = (name ?? "").trim();
  if (!raw) return "example.com";
  if (/\./.test(raw) && !/\s/.test(raw)) return raw.toLowerCase();
  const slug = slugify(raw).replace(/-/g, "");
  return `${slug || "example"}.com`;
}

export function emailFor(name: string | null | undefined, domain: string): string | null {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const first = slugify(parts[0]).replace(/-/g, "");
  const last = parts.length > 1 ? slugify(parts[parts.length - 1]).replace(/-/g, "") : "";
  if (!first) return null;
  return last ? `${first}.${last}@${domain}` : `${first}@${domain}`;
}

export function linkedinFor(name: string | null | undefined, seed: string): string | null {
  const slug = slugify(name ?? "");
  if (!slug) return null;
  const suffix = (hashSeed(seed) % 900 + 100).toString();
  return `https://www.linkedin.com/in/${slug}-${suffix}`;
}

export function crmUrlFor(_seed: string): null { return null; }

export function isoDay(offsetDays: number, from = new Date()): string {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Rough seniority band read off a job title, used to shape usage volume. */
export type Seniority = "exec" | "vp" | "director" | "ic";

export function seniorityOf(title: string | null | undefined): Seniority {
  const t = (title ?? "").toLowerCase();
  if (/\b(ceo|co-ceo|chief|cto|cfo|cmo|coo|president|chairman|founder)\b/.test(t)) return "exec";
  if (/\b(vp|vice president|svp|evp|head of|global head)\b/.test(t)) return "vp";
  if (/\b(director|principal|lead|manager)\b/.test(t)) return "director";
  return "ic";
}

export const FEATURES = [
  "Agent conversations",
  "Slack assistant",
  "Knowledge search",
  "Frames",
  "Data warehouse queries",
  "Workflows & triggers",
  "Browser extension",
  "Custom agents built",
] as const;

export const TIERS = ["Enterprise", "Enterprise", "Business", "Trial"] as const;
