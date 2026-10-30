---
change: change-20261030-dense-icon-first-ui
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

Local working tree on 2026-10-30 on top of `e38032d`; not committed or deployed. The baseline `pnpm check` before the change passed 677 tests.

## UI

- `tests/ui/projections.test.mjs`: row badges are icons named by their text for Waiting and Later, carry the spoken Deadline prefix and list parent, Project and Tags as muted text; the inspector projection derives the Deadline chip from the draft pair and marks an empty own Hide until under a deferred parent (FR-002, FR-202).
- `tests/ui/collaboration.test.mjs`: a card renders bold, list and link Markdown without its markers, hides the empty Excluded row, renders the report summary, places Approve beside the selector with its full accessible name, revise as the disabled send icon of the composer and the three icon header controls, and keeps unchanged text nodes across a re-render (FR-101, FR-102, FR-104). The selector shows the delegation target and the runner line appears once work starts. The generated widget shows `1 waiting on you` on the Now rail badge (FR-201).
- `tests/ui/dom.test.mjs` on the generated widget: status choices have accessible names and no visible text; the date chips open one editor at a time, focus the date input, show the draft value, close on Escape with focus back on the chip and on a press outside, stay open for a press inside and toggle (FR-001, FR-003). With a narrow media query, opening details scrolls to the top, Back restores the list position and focuses the row, a wide layout never scrolls, and the stylesheet keeps save feedback and unknown-outcome recovery visible on the Detail page (FR-301, FR-302). Existing tests for autosave, partial raw Defer input, Edit/Done focus, conflicts, unknown outcomes and Undo pass unchanged apart from their visible-label expectations (FR-INV-001).
- Screenshots of the generated widget with a synthetic in-page host in headless Chrome at 1280×800 and 390×844 showed Flagged with details, the open Deadline editor, Now, the phone list and the phone Detail page. They led to content-sized Project chips and removing the nested frame of Now's collaboration cards.

## Repository gates

- Final `pnpm check`: lint, typecheck and 680 tests passed, with no failures, cancellations, skips or TODOs.
- `pnpm build` passed, including the plugin artifact verification.

## Limitations

ChatGPT and other host rendering, real touch devices, iOS safe areas without the list header, and screen reader output are unverified. `field-sizing` falls back to a fixed Project chip width in browsers without it. Screenshots use synthetic data and an in-page host, not the SPA shell.
