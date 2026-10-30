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

## Production release

On 2026-10-30, source `0ec4f24` (with `efcc9c6`), pushed to main as a fast-forward, was released together with `change-20261030-dense-icon-first-ui` and `change-20261030-collaboration-metadata` as revision `weave-api-dense-0ec4f24` with image `sha256:506e4553d82ac4b2bc80f103876d82c175da92f0af2638a0c9146a27357b5e7f` (Docker Buildx, linux/amd64). See the [release evidence](../../evidence/20261030-dense-ui-release/release.json).

- Backup execution `weave-backup-brwp7` failed with the previous image, as the nightly backups do while the backup role cannot read `state.client_names`. The recovery point is Neon PITR at 2026-10-30T07:32:19Z, recorded immediately before migrating. Migrator execution `weave-migrator-fpcb7` applied 0012 with the release image; a read-only check (`weave-migrator-rmqdw`) found the journal at 0012 and metadata stated in all 20 collaboration heads and 24 history bodies.
- The new revision passed its startup schema check and a no-traffic tagged liveness and readiness probe before receiving 100% traffic; the tag was removed. The previous revision logged nothing at warning or above between migration and the switch. Migrator and backup jobs now use the release image.
- Public checks after the switch: readiness 200, MCP with an invalid bearer 401 with a challenge, an untrusted-origin preflight 403, the SPA-origin preflight 204 with its exact origin and credentials, protected-resource metadata 200, an unauthenticated session 401.
- The static SPA is version `b0d3f5e2-ecac-4b08-974c-fb3cd0370702`, published right after the API switch because the new widget requires collaboration metadata and the previous one rejects it; only `workspace.html` changed. All seven public files matched the candidate hashes with the expected cache, framing and credentialed CORS headers ([asset manifest](../../evidence/20261030-dense-ui-release/asset-manifest.json), [public checks](../../evidence/20261030-dense-ui-release/public-verification.json)).

Not verified in production: authenticated Web UI behavior in a real browser, hosted MCP reads and writes of collaboration metadata, ChatGPT widget rendering (a widget the host cached before this release rejects snapshots with collaboration metadata until it refetches the resource), and a backup after migration. The zero-traffic tagged revision `weave-api-collab-3f3a6848` from an earlier release keeps failing its startup schema check, as it did before this migration.
