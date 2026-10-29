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

## Production release

On 2026-10-29, source `dc0b0ef`, pushed to main as a fast-forward that also carries the earlier unreleased commits `7ccf77c` and `d185bca`, was released together with `change-20261029-ux-first-redesign` and `change-20261029-collaboration-delegation` as revision `weave-api-review-dc0b0ef` with image `sha256:acc07cd68a8e2dd132a9574a6b8319699083a7e93611f75c79906a7ca62199f5` (Docker Buildx, linux/amd64). See the [release evidence](../../evidence/20261029-ux-redesign-release/release.json).

- Backup execution `weave-backup-sptzh` succeeded before migration. Migrator execution `weave-migrator-pfpjq` applied 0010 and 0011 with the release image, and the new revision passed its startup schema check before receiving 100% traffic through a no-traffic tagged probe; the tag was removed. The previous revision cannot decode collaboration bodies after 0011; no errors were logged for it between migration and the switch.
- `grant-runtime weave_runtime` (execution `weave-migrator-x8dv6`) failed with 42501 at its final `ALTER ROLE ... CONNECTION LIMIT`, because the migrator lacks CREATEROLE. A read-only privilege check (`weave-migrator-z2cj8`) showed the earlier table grants applied: the runtime role has SELECT, INSERT and UPDATE on `state.client_names`, and its connection limit is already 40.
- The backup role does not yet have SELECT on `state.client_names`, so a backup after migration would fail. Granting it was not performed in this session and is pending the operator.
- Public checks after the switch: readiness 200, MCP with an invalid bearer 401, an untrusted-origin preflight 403, the SPA-origin preflight 204 with its exact origin, protected-resource metadata 200, an unauthenticated session 401. No errors were logged for the new revision at the recorded observation time.
- The static SPA is version `b76270ce-6d05-4070-a98c-8ea9e7d5d045`, built from the same source with freshly rendered runtime settings and hosting rules. All seven public files matched the candidate hashes with the expected cache, framing and credentialed CORS headers ([asset manifest](../../evidence/20261029-ux-redesign-release/asset-manifest.json), [public checks](../../evidence/20261029-ux-redesign-release/public-verification.json)).

Not verified in production: authenticated Web UI behavior in a real browser, hosted MCP writes with summaries, relayed client names and delegation, hosted assigned-resource notifications, ChatGPT widget rendering and its browser storage, and a backup after migration.
