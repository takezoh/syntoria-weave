---
change: change-20261022-action-text-view-mode
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

- `lib/ui/model/rich-text.ts`: pure parser producing typed inline/block data, `safeHref`, and a memoizing model so unchanged text returns the same structure. Unmatched delimiter searches are cached to keep parsing linear; nesting depth is bounded.
- `lib/ui/model/view-state.ts`: `textEditing` view state (remapped with local identities) and pure `normalizeTextEditing`. `lib/ui/model/interaction.ts` adds the deferred `finish-text` intent.
- `lib/ui/application/controller.ts`: normalizes `textEditing` before publication and starts new local Actions in edit mode.
- `lib/ui/model/ui-projections.ts`: inspector `text` projection; parsing happens only in view mode.
- `lib/ui/components/rich-text.ts` and `inspector-panel.ts`: DOM rendering via `createElement`/`textContent`, retained nodes for unchanged content, toggle label/state.
- `lib/ui/effects/dom.js`: Edit/Done handlers, focus effects, IME deferral and `ui/open-link` requests. `lib/ui/client.ts` composes the rich-text model.
- `lib/widget.ts`: view/edit containers, toggle and styles. `web/client.ts`: the static SPA host handles `ui/open-link` for web/mail URLs with `noopener,noreferrer`.
