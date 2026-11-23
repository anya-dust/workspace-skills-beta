---
name: Account Map
description: >
  Use when someone wants to install, build, populate, extend, or reason about an
  account map: an org-chart-style stakeholder map for an account plan. Trigger
  phrases: "install the account map", "map the org at [company]", "build an
  account map", "who else should we know at X", "where are our multithreading
  gaps", "add these people to the map", "scan the map for blind spots".
  This skill's files are a FLAT map of the Frames v2 package. Reconstruct the
  tree from LAYOUT.txt, then register and publish. Never scaffold or rewrite.
---

# Account Map

The app is a Frames v2 package (UI + 19 functions + `accountmap` SQLite). Skill
**Files** cannot keep directories, so every source file is attached **flat** at:

`/files/conversation-<conversationId>/skills/Account Map/`

`__` in a filename stands for `/` in the real tree. `frame_manifest.json` is the
exception: it becomes `manifest.json`.

## Hard rules (install)

- Never run `dsbx frame create`.
- Never call `create_interactive_content_file`.
- Never write `AccountMap.tsx`, functions, or UI from scratch.
- Never `cp`/`mv` a registered Frame folder.
- Reconstruct the tree from the layout below, then register and publish.
- After copy, only replace `__POD_ID__` and `__WORKSPACE_ID__`.

## Layout (flat name → dest under AccountMap/)

Read `LAYOUT.txt` from the skill files directory if present. Otherwise use this
table. Skip comment lines. Do not copy `LAYOUT.txt` or `SKILL.md` into the Frame.

```
frame_manifest.json	manifest.json
AccountMap.tsx	AccountMap.tsx
databases__accountmap.db.ts	databases/accountmap.db.ts
functions__create-map.ts	functions/create-map.ts
functions__delete-contact.ts	functions/delete-contact.ts
functions__delete-edge.ts	functions/delete-edge.ts
functions__delete-note.ts	functions/delete-note.ts
functions__delete-role.ts	functions/delete-role.ts
functions__dismiss-blind-spot.ts	functions/dismiss-blind-spot.ts
functions__get-map.ts	functions/get-map.ts
functions__import-map.ts	functions/import-map.ts
functions__lib__actions.ts	functions/lib/actions.ts
functions__lib__gaps.ts	functions/lib/gaps.ts
functions__lib__store.ts	functions/lib/store.ts
functions__lib__synth.ts	functions/lib/synth.ts
functions__move-items.ts	functions/move-items.ts
functions__next-best-actions.ts	functions/next-best-actions.ts
functions__resolve-blind-spot.ts	functions/resolve-blind-spot.ts
functions__save-contact.ts	functions/save-contact.ts
functions__save-edge.ts	functions/save-edge.ts
functions__save-note.ts	functions/save-note.ts
functions__save-role.ts	functions/save-role.ts
functions__scan-blind-spots.ts	functions/scan-blind-spots.ts
functions__send-agent-task.ts	functions/send-agent-task.ts
functions__update-action.ts	functions/update-action.ts
functions__update-map.ts	functions/update-map.ts
ui__ActionQueue.tsx	ui/ActionQueue.tsx
ui__BlindSpotCard.tsx	ui/BlindSpotCard.tsx
ui__ContactCard.tsx	ui/ContactCard.tsx
ui__CoveragePanel.tsx	ui/CoveragePanel.tsx
ui__FilterMenu.tsx	ui/FilterMenu.tsx
ui__SettingsModal.tsx	ui/SettingsModal.tsx
ui__StickyNote.tsx	ui/StickyNote.tsx
ui__dialogs.tsx	ui/dialogs.tsx
ui__types.ts	ui/types.ts
ui__usage.tsx	ui/usage.tsx
CHECKLIST.md	CHECKLIST.md
DESIGN.md	DESIGN.md
```

Rule of thumb: `functions__lib__store.ts` → `functions/lib/store.ts`. Only
`frame_manifest.json` does not follow that rule.

## 0. Provision the Frame (do this first)

Run inside the Pod that will host the app. `POD_ID` = `vlt_...`,
`WORKSPACE_ID` = workspace id.

If `/files/pod-<POD_ID>/AccountMap/manifest.json` is already a registered Frame,
skip to section A. Do not copy on top of it.

```bash
SRC="/files/conversation-<conversationId>/skills/Account Map"
DST="/files/pod-<POD_ID>/AccountMap"

mkdir -p "$DST"
# LAYOUT.txt if uploaded; otherwise paste the table above as the here-doc.
while IFS=$'\t' read -r flat dest; do
  case "$flat" in ""|\#*) continue ;; esac
  mkdir -p "$DST/$(dirname "$dest")"
  cp "$SRC/$flat" "$DST/$dest"
done < "$SRC/LAYOUT.txt"

sed -i "s|__POD_ID__|${POD_ID}|g" "$DST/AccountMap.tsx" "$DST/functions/send-agent-task.ts"
sed -i "s|__WORKSPACE_ID__|${WORKSPACE_ID}|g" "$DST/functions/send-agent-task.ts"

dsbx frame publish  "$DST/manifest.json"
```

Then `open_frame` with `path` = `/files/pod-<POD_ID>/AccountMap/manifest.json`.
Pin with `set_pinned_frame` to that same path.

Smoke: `dsbx frame call /files/pod-<POD_ID>/AccountMap get-map --input '{}'`.
Expect 10 seeded roles.

If validate/publish fails, fix the reported error. Do not recreate the Frame.

Call functions with bare names:

```bash
dsbx frame call /files/pod-<POD_ID>/AccountMap get-map --input '{}'
```

Do not prefix `accountmap__`.

---

## A. Research a company and populate a map

### A1. Stakeholder discovery (waterfall, with retry limits)

1. **Primary — people/prospect search**: search by company + ICP job titles. Respect any
   geographic filter the user gives, in every search. Cap at the top 15–20 most relevant
   people; stop once ICP coverage is good. Never repeat the same title+location search.
2. **Secondary — LinkedIn/Surfe-style tools**: only if the primary pass returns fewer than
   ~5 ICP-fit contacts, and only for titles not yet covered. On failure, retry once with a
   simplified query, then move on. Never retry more than twice.
3. **Enrichment fallback**: for contacts missing email, enrich by LinkedIn profile URL. Max
   2 attempts, then infer from the company domain pattern (check existing contacts on the
   map for the pattern: `firstname.lastname@`, `first.last@`, `flast@`; ask if unsure).
4. **Internal signals**: search calendar, email, and CRM engagements for anyone at the
   company domain. People already talking to us belong on the map. Only set
   `isContacted: true` if the **user** confirms it.
5. Always target: the CEO at the top, C-suite direct reports, and any known champions or
   existing users.

Enrichment rules: only fill blank/unknown fields, **never** overwrite verified data, never
invent emails or URLs (omit instead).

### A2. Deal roles

Assign by exact `roleName` match against the seeded roles: `Builder`,
`Champion - Business`, `Champion - Executive`, `Champion - Technical`, `Economic Buyer`,
`Evaluator - Business Value`, `Evaluator - Technical Fit`, `Super User`,
`Target to Engage`, `Weak User`.

Leave `roleName` null when unknown. Do **not** guess. `Target to Engage` is the right role
for a high-value ICP contact you have not engaged yet.

### A3. Edge rules (conservative connections)

Edge direction is always **source = manager, target = report**.

DO connect (`kind: "default"`, solid) when: there is a clear title hierarchy within the same
function (VP Sales → Director Sales); LinkedIn, press, or a public org chart shows the
reporting line; the user states it.

DO NOT create a reporting edge when: titles are similar but departments differ; the only
signal is seniority; the relationship is peer-level (two VPs). Use `kind: "influence"`
(dashed) for meaningful peer/influence relationships instead, sparingly.

Never create circular reporting chains. When in doubt, leave the contact unconnected and
flag it in your summary.

### A4. Layout — the Legend (compact organic pyramid)

World coordinates. Card width 256, card height ~230. X = functional zone, Y = seniority.
The Frame surfaces this as a collapsible **Map Key** panel; there are **no painted grid
bands**. Spacing must be compact like a real org chart: dense clusters, short edges. Never
an evenly spaced grid, never a loose scatter.

**Y = seniority level (top to bottom):**

| Level | Who |
|---|---|
| A | Tip-top execs: CEO, CIO, CISO, CFO |
| B | Execs/C-suite that still have a boss: CTO, CRO, COO, CMO, CDO, CPO, CBO |
| C | Senior leaders: VPs and department heads |
| D | Department power players: Directors, leaders with >= 2 levels above them |
| E | Managers / team leads: day-to-day interest, influence but no buying power |
| F | ICs and (super) users: bottom-up champions who prove value with their own use cases |

**X = functional zone (left to right):** 1 AI · 2 Sales customer-facing (AE, AM, SDR) ·
3 Sales supporting (SE, Sales Consultant) · 4 Sales Ops / Enablement · 5 Support ·
6 IT / Business Ops / Strategy / internal ops · 7 Recruiting / HR / Talent · 8 Product ·
9 Engineering · 10 Misc / Other · 11 Legal / Procurement / Finance.

**Spacing math (keep it tight):**

- Level pitch: 380px per occupied level step (~150px vertical gap between card rows). Start
  the topmost occupied level at y=0 and collapse empty leading levels.
- Siblings in a cluster: 340px apart (~84px gutters), max ~3 per row; overflow ICs go to a
  staggered second row +260px below the F row.
- Zones: keep the 1 → 11 order but **collapse empty zones entirely**, no reserved width.
  Leave ~200px of empty canvas between adjacent zone clusters.
- A ~25-contact map should span roughly **5000 x 1600** world px, not 10000+.
- Top execs top-center of the populated area, sales left, engineering right: a pyramid
  silhouette. Align managers above their reports and keep vertical lanes open so no edge
  passes through another card's bounding box.
- Empty zones and levels are still signal. The whitespace no longer shows on canvas, so
  always call out missing A/B coverage and empty functions as multithreading gaps in your
  written summary.
- Former employees: park in Zone 10 (Misc) at their historical level with an explanatory
  note. Never mix them into an active functional zone.
- **Import preflight is mandatory.** Never send `posX: 0, posY: 0` for a populated roster.
  Assign every contact a level (A–F) and zone (1–11), compute coordinates with the spacing
  math above, and validate that every reporting edge runs from a higher level to a lower one.

**Avatars:** once the roster is final, enrich real profile photo URLs. Bulk-match by
LinkedIn URL first (batches of ~10), per-profile enrichment as fallback. Discard LinkedIn's
generic ghost image (`static.licdn.com/aero-v1/...`): a placeholder is worse than the card's
initials. Save via `save-contact` `avatarUrl`; leave blank when no real photo exists. Never
invent or guess an image URL.

### A5. Import

Call `import-map` **once** with the full payload:

- `name`: company name (creates the map). Pass `mapId` instead to add into an existing map.
- `contacts`: `[{ ref, name, jobTitle, email?, linkedinUrl?, avatarUrl?, notes?, roleName?,
  isContacted?, posX, posY }]`. `ref` is any stable string key ("ceo", "cfo").
  (`customContext` is accepted by the schema for completeness; agents must leave it unset.)
- `edges`: `[{ sourceRef, targetRef, kind }]`, source = manager, target = report.
- `notes` (optional): sticky notes with `body`, `posX`, `posY`.

Then verify with `get-map`. Tell the user to open the Account Map tab.

## B. Blind spots and next-best-actions

- `scan-blind-spots` `{ mapId }`
- `resolve-blind-spot` `{ id, name?, jobTitle?, roleId? }`
- `dismiss-blind-spot` `{ id, dismissed? }`
- `next-best-actions` `{ mapId }`
- `update-action` `{ mapId, actionKey, status, agentConversationUrl? }`

## C. Operate an existing map

`dsbx frame call /files/pod-<POD_ID>/AccountMap <name> --input '<json>'`

- `get-map` `{ mapId? }`
- `save-contact` / `delete-contact` / `move-items`
- `save-edge` / `delete-edge`
- `save-note` / `delete-note` / `save-role` / `delete-role`
- `create-map` / `update-map`
- Bulk: one `import-map` with `mapId` set

### Rules for agents editing maps

- Never invent emails, LinkedIn URLs, or avatar URLs. Omit unknown fields.
- **Never change `isContacted`.** Human-owned.
- **Never write `customContext`.** Research goes in `notes`.
- Place new cards without overlapping (~320–340px spacing).

## D. Multithreading strategy (when asked for engagement advice)

- **Yo-yo selling** (default): high (C-suite/VP) on vision → down for validation → back up.
- **Land and expand** (stuck low): 3–4 parallel team evaluations, then IT/exec.
- Managers/ICs: day-to-day value. VP+: vision.

Call out empty seniority levels and empty functional zones.

## E. Agent actions in the Frame

Ask Dust menu calls `send-agent-task`. Do not guess profile photos.

## F. Maintenance

Edit files under `/files/pod-<POD_ID>/AccountMap/`, then `dsbx frame validate` and
`dsbx frame publish` on `manifest.json`. Additive-only DB schema changes. Never
`dsbx frame create`. Read `DESIGN.md` before visual changes; re-run `CHECKLIST.md`.
