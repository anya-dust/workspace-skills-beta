# DESIGN — Account Map visual and structural system

Read this before restyling, extending, or rebuilding. Every rule here was paid for by a
version that got it wrong.

## 1. The premise

**The canvas is the product. Chrome is a tax on it.**

An account map is a spatial artifact: the team learns the shape of the org and navigates by
memory of where people sit. Everything below follows from that. It is why cards dim instead
of disappearing, why the grid is a legend and not painted bands, and why there is exactly
one row of top chrome.

## 2. Layout model

- **World coordinates**, not screen coordinates. Cards store `posX`/`posY` in world space;
  the viewport is `{x, y, k}` (pan + zoom). Zoom range 0.08 → 2.5.
- Card width **256** (`CARD_W`), height ~230 (`CARD_H_FALLBACK`, measured at runtime).
- Canvas background: a 1px dot grid, `radial-gradient(circle, #d4d4d8 1px, transparent 1px)`,
  which scales with zoom and gives motion a reference frame. There are **no painted grid
  bands or zone stripes**: they made a sparse map look broken and boxed in the layout.
- Placement semantics (X = function 1–11, Y = seniority A–F) live in the collapsible
  **Map Key** panel, bottom-right, with a Deal Roles tab beside it. One legend, two tabs,
  never two stacked panels.
- Spacing math is in `SKILL.md` §A4 and is normative for agents importing rosters. The short
  version: 380px level pitch, 340px sibling pitch, collapse empty levels and zones, ~200px
  between zone clusters, ~5000 x 1600 world px for 25 contacts. Compact and organic, like a
  real org chart. Never an evenly spaced grid, never a scatter.

## 3. Color

| Token | Value | Use |
|---|---|---|
| `ACCENT` | `#6b46f5` | Primary actions, active states, badges |
| Agent button | `violet-700` → `violet-800` | The one Ask Dust entry point |
| Connect mode | teal (source) / emerald (target) | Two-click link gesture |
| Coverage / blind spots | `red-600` | The panel that says something is missing |
| Sticky notes | amber | Human annotation, never data |
| No role | `#e5e7eb` | Cards with no deal role assigned |

Severity: critical `#dc2626`, high `#ea580c`, medium `#ca8a04`.
Health: ≥70 `#059669`, ≥45 `#ca8a04`, >0 `#dc2626`, none `#94a3b8`.

Deal role colors are **data**, stored per role in the DB and editable by the user, not
constants in the code. Default palette: Builder `#15803d`, Champion - Business `#eab308`,
Champion - Executive `#7c3aed`, Champion - Technical `#fdba74`, Economic Buyer `#bbf7d0`,
Evaluator - Business Value `#7dd3fc`, Evaluator - Technical Fit `#f9a8d4`, Super User
`#2dd4bf`, Target to Engage `#ef4444`, Weak User `#d1fae5`.

A card is tinted with a 20% wash of its role color over white (`tint()`), never filled
solid: at 100% the canvas turned into a bag of skittles and the photos stopped reading.
Text color flips to white on dark role chips via `isDark()`, a luminance test, not a
hardcoded list.

## 4. Surface language

Everything floating over the canvas is the same object: `rounded-xl`/`rounded-lg`,
`border-gray-200`, `bg-white`, `shadow-lg`. Primary canvas actions (New Contact, New Note)
are `rounded-full` pills, bottom-left. Zoom controls are a `rounded-full` segmented cluster.
Toasts are `bg-gray-900` (or `bg-red-600` for errors), bottom-center. The minimap sits
bottom-right above the legend.

Icons: `lucide-react`, size 16 in chrome, consistently.

## 5. Chrome budget (hard rules)

- **One row of top chrome.** Its height is measured with a `ResizeObserver` (`topBarH`),
  never hardcoded: a squeezed button wraps its label and grows the bar, and anything
  positioned below it must read the measured value.
- Top-bar buttons carry `shrink-0 whitespace-nowrap` so labels never wrap. The bar wraps
  whole groups instead.
- **Every agent action lives under the single `Ask Dust` menu.** They all open a Dust
  conversation, so they are one action with presets, not four peer buttons. Add new agent
  workflows as menu items.
- **One legend**, with tabs.
- **Do not ship a control that does nothing.** A History button that only raised a
  "coming soon" toast was removed. Add it back when it works.

## 6. Search and filters

Search sits directly in the top bar and is the primary way into a large map. It matches
name, job title, email, research notes, human context, and deal role name, case-insensitively.
Enter frames the current matches; Escape clears.

Filters live behind a `Filters` button as a menu (`ui/FilterMenu.tsx`) because they are
secondary to search and must not cost the canvas a permanent row. Groups combine with AND:
relationship (contacted / not), adoption (active / users / non-users), and deal role. The
button badge counts active filter **groups**, not the search box.

**Non-matching cards are dimmed, never hidden.** Removing cards destroys the spatial shape
people navigate by. Edges dim when either endpoint is dimmed, so no line dangles into a
faded card.

## 7. Edges

- `default` = reporting line, solid. `influence` = peer/influence, dashed.
- Direction is always source = manager, target = report.
- **Anchors are geometric, not always top-to-bottom.** `edgePath` picks each card's anchor
  side from the vector between centers (`|dx| > |dy| * 1.2` → left/right, otherwise
  top/bottom, control-point offset signed by direction) via the shared `curveBetween` /
  `cardBox` helpers. The old always-bottom-to-top version looped curves back through the
  cards for peer and upward links.
- Clicking an edge opens a small inline toolbar at its midpoint: toggle kind, delete.

## 8. Connect mode (regression-prone, do not break)

Linking is a two-click gesture: click a teal connect handle on a card edge (visible on
hover), then click the target card. It broke once because the card body is fully covered by
its own interactive children (contacted toggle, role chip, email/LinkedIn/Google links),
each stopping propagation, so most clicks never reached the card's `onClick`.

Invariants:

- **Full-card hit layer.** When `isConnectTarget`, the card renders a last-child absolute
  `inset-0 z-50` overlay that owns the completion click (`onPointerDown` stops propagation
  and prevents default, `onClick` calls `onCompleteConnect`). Never rely on the card root's
  `onClick`, and never leave inner buttons reachable in connect mode: a stray click must not
  toggle `isContacted` or open a tab.
- **No hover affordances while connecting.** Directional add/connect handles hide whenever
  `connectSource != null`, on every card, so the source cannot start a second gesture
  mid-connection.
- **Both ends are labelled.** Source: teal ring + "Connecting from here". Targets: emerald
  ring + a "Click to connect" badge that shows without hover.
- **Rubber band.** `connectPos` tracks the cursor in world coordinates
  (`(client - rect - vp) / vp.k`, updated in the canvas `onPointerMove`) and renders a dashed
  teal preview inside the edge SVG. Clear it through `cancelConnect()` everywhere
  `connectSource` is cleared: Escape, empty-canvas click, completion, Cancel.
- **Escape is not enough.** Keyboard Escape only fires when the canvas container has focus,
  so the connect banner must keep its explicit Cancel button.

## 9. Data ownership (the rule that makes the app trustworthy)

Two fields on a contact are **human-owned and agents must never write them**:

- `isContacted` — relationship state.
- `customContext` — free-text intel a human typed that no research reproduces ("friend of
  Nico", "burned by a competitor in 2024"). It is the most valuable field on a card. Agents
  read it, treat it as ground truth when it conflicts with research, and say so in their
  report rather than editing it.

`notes` is the agent-owned field: research findings go there and may be rewritten freely.

This split is why people trust the map enough to type into it. Do not blur it.

## 11. Blind spots and actions

Blind spots render as **ghost cards**: same geometry as a contact card, visually provisional,
carrying a suggested person and a warm-intro path. They occupy the hole they describe, which
is the whole point: the gap is shown where it exists in the org, not in a list. Spots without
a position hang off their anchor contact instead.

The action queue is derived from the map on every call; only done/snoozed state persists.
Each action carries the agent prompt that would do the work, so the queue is a set of
one-click delegations rather than a to-do list.

## 12. Extending it

Before adding anything, answer: does this belong on the canvas, in the single Ask Dust menu,
or in a panel behind a button? If the answer is "a new top-bar button", it is probably a menu
item. If the answer is "a new always-visible panel", it is probably a tab in an existing one.
