# CHECKLIST — post-install verification

Run all of it after a fresh install, and re-run sections 3–5 after touching card, canvas, or
edge code.

## 1. Plumbing

- [ ] `sandbox_functions__list` shows **20** `accountmap__*` slugs.
- [ ] `send-agent-task` is published as **durable**; the other 19 as **fast**.
- [ ] `accountmap__get-map` `{}` returns a snapshot with **10 roles** and no error.
- [ ] No `__POD_ID__` / `__WORKSPACE_ID__` left: `grep -rn "__POD_ID__\|__WORKSPACE_ID__" /files/pod/AccountMap`.
- [ ] The Frame is pinned as a Pod tab and opens without a console error.

## 2. First map

- [ ] Create a map from the Frame (New Map) or via `accountmap__create-map`.
- [ ] Add a contact from the canvas; it persists across a refresh.
- [ ] Import a small roster with `import-map` (3 contacts, 2 edges) and confirm counts with
      `get-map`.
- [ ] Positions are non-zero and the layout reads as a pyramid, not a row.

## 3. Contact card controls

Every one of these must work, on a card at default zoom and at 0.5x:

- [ ] Edit and save; Cancel discards.
- [ ] Upload a local image (it is resized in the Frame before saving).
- [ ] Link an image URL.
- [ ] Mark contacted (toggle persists).
- [ ] Assign a deal role (card tint changes to the 20% wash).
- [ ] Open Google / email / LinkedIn (new tab, does not select the card).
- [ ] Delete.
- [ ] Add a directional contact from a hover handle.

## 4. Connect mode (the regression)

- [ ] Start a connection from a handle: the source card gets a teal ring and
      "Connecting from here".
- [ ] Move the cursor: the dashed rubber band follows in world space, at any zoom.
- [ ] Every other card shows an emerald ring and a "Click to connect" badge **without
      hovering**.
- [ ] Click a target **directly on its role chip** → the link completes, no role picker opens.
- [ ] Click a target **directly on its links row** → the link completes, no new tab opens.
- [ ] While connecting, no card shows add/connect hover handles.
- [ ] Start another connection and hit the banner's **Cancel** → band clears, rings clear.
- [ ] Escape with the canvas focused also cancels.

## 5. Canvas and chrome

- [ ] Wheel zoom feels right on both a mouse (discrete notches) and a trackpad (continuous).
- [ ] Fit-to-content (`0`) frames the whole map.
- [ ] The minimap reflects cards, ghost cards, and notes.
- [ ] Edges between peers (side by side) anchor left/right, not bottom-to-top loops.
- [ ] Click an edge → inline toolbar at the midpoint: toggle kind, delete.
- [ ] Top chrome is **one row**; no button label wraps; panels below it start at the measured
      `topBarH`.
- [ ] Search matches name, title, email, notes, context, and role name; non-matches **dim**,
      nothing disappears; Enter frames matches; Escape clears.
- [ ] The Filters badge counts active filter groups, not the search box.
- [ ] Legend is one panel with Map Key and Deal Roles tabs.

## 6. Agents

- [ ] Ask Dust → any preset opens a new conversation **in this Pod** with the map id and
      account name injected.
- [ ] A contact-scoped action injects that contact's record, including `customContext`
      flagged as never-overwrite.
- [ ] An agent edit through `accountmap__save-contact` shows in the Frame after a refresh.

## 8. Data ownership guardrail

- [ ] Type something into a card's human context field, then run an agent research task over
      the same contact. The context field must be **unchanged** and the findings must land in
      notes. If an agent overwrote it, fix the agent's instructions, not the field.
