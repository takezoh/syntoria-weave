---
change: change-20261030-dense-icon-first-ui
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

Responsibilities stay in their layers ([UI architecture](../../technical/ui-architecture.md)).

- `model/ui-projections.ts`: row badges carry `iconOnly`, `prefix` and a `muted` tone; the inspector projection adds `chips.due` and `chips.defer` derived from the draft date pairs with an injected local-date formatter.
- `model/collaboration.ts`: each decision carries its `slot`, visible `text` and `icon`; cards carry parsed `text` for the human-facing fields through an injectable parser; panel data adds `requestAvailable`. `model/rich-text.ts` adds a bounded keyed parse cache so several card texts keep their node identity.
- `model/view-state.ts`: the picker kinds add `due` and `defer`, so the existing open/close, Escape and outside-press handling covers the date editors and keeps one popup open.
- `components/inspector-panel.ts` renders the date chips and the icon-only Edit/Done toggle, hides Notes in edit mode and renders Tag chips as name then remove mark. `components/collaboration-panel.ts` lays out the card and places decisions by slot, rendering Markdown through `components/rich-text.ts`. `components/outline-list.ts` renders icon-only and prefixed badges. `components/now-panel.ts` uses short headings and icon header controls.
- `widget.ts`: the inspector markup orders toolbar, title, text editor, chips, date editors, Notes, save problem, Work with AI and activity; a final CSS layer applies the dense icon-first layout, the 56 px icon rail on wide layouts and the narrow List/Detail pages.
- `effects/dom.js`: chips toggle the `due`/`defer` pickers; the outside-press rule keeps chips and editors open; rail badges show a number with a spoken suffix; collaboration panels receive icons and the parse cache; `turnPage` records and restores the list scroll position on narrow layouts.

No storage, API, MCP or write contract changes.
