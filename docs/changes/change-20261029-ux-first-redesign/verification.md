---
change: change-20261029-ux-first-redesign
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

Local working tree on 2026-10-29; not committed or deployed. The baseline `pnpm check` before the change passed 628 tests.

## Data and service

- `tests/data/model/change-cursor.test.mjs`: summaries and client names are projected verbatim; undefined, blank, oversized, malformed and orphan values fail with `invalid_state`. Recent pages read newest first with undo markers, stop at retained history and reject gaps, misordered rows, mismatched ranges, malformed undo IDs and invalid limits.
- `tests/application/recent-changes.test.mjs` (memory store): summaries travel with operations; Undo availability matches the actual Undo write, including a conflict after a later change and its Undo; paging, user isolation, blank summaries and a store without recent history (`unavailable`, 503).
- `tests/postgres/change-review.test.mjs` (real PostgreSQL 17): creator and latest changer follow the verified committer through structure creation, cascade completion and Undo by another client, and never enter feed records; concurrent identical summarized requests commit once, a changed summary is `idempotency_conflict`, invalid summaries are rejected, a lost COMMIT response resolves by exact replay; recent history pages newest first with `available`, `conflict`, `undone` and `not_undoable`; client names are written only by client writes with a valid name, are user-scoped and replaced per connection, and reads and browser sessions never write them. Overwriting creators in the upsert was injected and failed 4 subtests before being restored.
- `tests/postgres/server.test.mjs` (Node HTTP/MCP with real PostgreSQL): a Gate-named client writes with a summary over MCP, the person corrects the Action through the browser API, an invalid relayed name is ignored, `list_recent_changes` over the browser API shows actor, name, summary and Undo status, `get_changes` carries names, and another user sees none of it.
- `tests/postgres/transfer.test.mjs` and `user-identity-migration.test.mjs`: version 8 exports and round-trips the new columns and table and rejects version 7; migrating from the original schema leaves provenance unknown and no summaries or names.
- `scripts/testing/verify-gate-integration.mjs` with the actual Gate checkout including `change-20261029-introspection-client-name`, the Firestore Emulator and real PostgreSQL: the DCR client registered as "MCP integration" is verified with that name, its summarized MCP write records it as creator, and `list_recent_changes` returns the operation with the name, summary and `available` Undo. Result: passed.

## UI

- `tests/ui/review.test.mjs`: Now projection (flag order, overdue and seven-day deadlines, no mutation), capture titles (first visible line, limit, surrogate pairs), quick dates, change lines for every Action field and catalog change, feed filters, day groups, review counts and Undo reasons, actor labels, `needsPerson`, page validation and status hints; the changes controller loads only for visible review views, ignores stale responses, pages, keeps the last list on failure and writes the mark only through its port, ignoring a mark beyond the head; the review mark store survives absent or throwing storage.
- `tests/ui/dom.test.mjs` on the generated widget: landing on Now with rail counts, flagged and overdue rows; Save to Inbox through a lost response keeps the text, shows recovery and retries the exact request; Changes renders claims beside lines, filters, explains a blocked Undo and sends one Undo with the exact `undoOf` and current revision, then reloads; marking reviewed persists per browser and counts a later connection save as new; the inspector shows provenance, status labels and explanation, and a quick date produces one Defer save. Existing DOM tests start from Inbox, and their expectations were updated for the renamed Done & dropped view, the view order, the view rail landmark and the Waiting/Deadline labels.
- Screenshots of the generated widget with a synthetic in-page host in headless Chrome at 1280 and 390 px showed Now, Changes and Inbox with details. They revealed and led to fixing a hidden phone view strip, a duplicated "Work with AI" heading, an overflowing status control and mixed status labels.

## Repository gates

- Final `pnpm check`: lint, typecheck and 651 tests passed, with no failures, cancellations, skips or TODOs.
- `pnpm build` passed, including the plugin artifact verification. `pnpm test:node:built` passed against the built server and real PostgreSQL.

## Limitations

Hosted Neon, Cloud Run, the deployed Gate and real MCP hosts are not exercised. ChatGPT host rendering, its browser storage in the widget frame and rail behavior in inline mode are unverified. Screenshots use synthetic data and an in-page host, not the SPA shell. Documentation schema lint for this change package was not run because the dev-docs execution server was unavailable.
