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

## Production release

On 2026-10-29, source `763791d` was released as revision `weave-api-retention-763791d` with image `sha256:7787d24ee98df6b0b0da7d21899ca3623c5eb60ea2f6484a2e7960846f414b43` (OCI index, built with Docker Buildx for linux/amd64). The release also carried the earlier unreleased commits `42ac8a5` and `6cdba94`.

- Backup execution `weave-backup-pkmb4` succeeded before migration (661,778 bytes).
- Migrator execution `weave-migrator-t299q` applied `0005_operation_client_provenance.sql` with the new image. The new revision then passed its startup schema check.
- The revision was probed through a no-traffic tag before receiving 100% traffic. The tag was removed afterwards. The backup job also uses the new image.
- Public checks: `/health/ready` 200, MCP POST with an invalid bearer 401, untrusted-origin preflight 403, MCP resource metadata 200.

No hosted write has exercised period retention or `client_id` yet. Configuration, secrets, IAM and DNS were unchanged.

## Actor kind follow-up (2026-10-29)

- `tests/data/model/change-cursor.test.mjs`: `actor_kind` values `user` and `client` are projected; undefined, `owner`, `USER` and numbers fail with `invalid_state`.
- `tests/postgres/server.test.mjs`: a browser-session write through Node HTTP records `user`, and an MCP bearer write records `client`. Swapping the mapping in authentication made both cases fail, and they passed again once restored.
- `tests/postgres/action-store.test.mjs`, `transfer.test.mjs` and `user-identity-migration.test.mjs`: the change feed returns `actor_kind`, version 5 transfer round-trips it, version 4 is rejected, and migrated operations keep NULL.
- `pnpm check`: lint, typecheck and 591 tests passed, with no failures, skips or TODOs.

### Production release of actor kind

On 2026-10-29, source `a72872c` was built from a clean worktree, without unrelated uncommitted work in the main checkout. It was later pushed as `494ce6d`, rebased onto the concurrent UI commit `6e0707c`; the deployed image does not contain `6e0707c`. It was released as revision `weave-api-actor-a72872c` with image `sha256:ae54dbd1e6b4c68c815cc3ba69ea2bf37f183a9397587253c71b08f3cadd6996` (OCI index, linux/amd64). Before release, `pnpm check` passed 587 tests in that worktree and `pnpm build` passed.

- Backup execution `weave-backup-ghkh7` succeeded before migration.
- Migrator execution `weave-migrator-6zb8d` applied `0006_operation_actor_kind.sql`. The new revision then passed its startup schema check.
- The revision was probed through a no-traffic tag before receiving 100% traffic. The tag was removed afterwards. The backup job also uses the new image.
- Public checks: `/health/ready` 200, MCP POST with an invalid bearer 401, untrusted-origin preflight 403.

No hosted write has exercised `actor_kind` yet.

### Release scope, configuration and credentials

- **Scope.** Both releases on 2026-10-29 were API-only. The separately hosted web SPA was not redeployed, and its serving version was not read for this record. The earlier unreleased UI commits `42ac8a5` and `6cdba94` therefore reached only what the API serves, including the MCP UI resource; the web SPA still needs its own release. The concurrent UI commit `6e0707c` is not in either deployed image.
- **Configuration.** The API and job secret references are unchanged: `weave-runtime-database:2` for the API, `weave-admin-database:2` for the migrator and `weave-backup-database:2` for the backup job. The schema journal now lists `0001_state.sql` to `0006_operation_actor_kind.sql`, which matches the API's startup check. IAM, DNS and runtime settings are unchanged.
- **Credentials.** After the shared Neon owner password was changed on 2026-10-29, migrator execution `weave-migrator-plnp6` and backup execution `weave-backup-g7pms` both succeeded, so Weave's credentials do not depend on the old password. The runtime role passes the startup check that rejects superuser, row-security-bypassing and table-owning roles. It was not exercised with a new connection after the change.

