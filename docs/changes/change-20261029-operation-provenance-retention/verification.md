---
change: change-20261029-operation-provenance-retention
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

Local working tree on 2026-10-29; not committed or deployed.

- `tests/data/model/storage.test.mjs`: policy constants, cutoff and prune boundaries (all inside the period, all older, mixed, maximum, short history).
- `tests/data/model/change-cursor.test.mjs`: `client_id` is projected verbatim and undefined, empty, padded, oversized, control-character and non-string values fail with `invalid_state`.
- `tests/adapters/operations-retention.test.mjs` (memory and SQLite D1): 150 operations inside the period are all retained with replay and Undo eligibility; operations older than the period are pruned to the latest 100 with user isolation, unknown-outcome replay and atomic rollback of a failing prune; seeded older history shrinks on the next write; seeded history inside the period is capped at 5000.
- `tests/postgres/action-store.test.mjs` (real PostgreSQL 17): two expired and 148 recent operations leave 148 rows from revision 3 with every row attributed to the verified client and the old cursor expired; seeded 5100 recent operations leave 5000 with only the new operation attributed; the change feed returns `client_id`.
- `tests/postgres/transfer.test.mjs`: version 4 export includes and round-trips `client_id`; version 3 is rejected. `tests/postgres/user-identity-migration.test.mjs`: forward migration from the original schema leaves migrated operations with NULL `client_id`.
- `node scripts/testing/run-tests.mjs postgres`: 29 passed, 0 failed or skipped. Targeted data-model and retention suites: 26 passed.
- `tests/application/change-cursor.test.mjs`: a cursor expires only after an operation older than the period is pruned beyond the latest 100.
- Final `pnpm check`: lint, typecheck and 587 tests passed, with no failures, skips or TODOs. `pnpm build` passed.
- Two deliberate faults were each detected and then reverted: ignoring the period in `operationPruneThrough` (6 failures across pure, memory and PostgreSQL tests) and inserting a null client ID in the PostgreSQL store.

## Limitations

Hosted Neon, Cloud Run and real client hosts are not exercised. Retention timing depends on the server clock.
