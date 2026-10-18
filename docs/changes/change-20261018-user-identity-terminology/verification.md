---
change: change-20261018-user-identity-terminology
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

## Content

Real embedded PostgreSQL tests exercise concurrency, replay, missing responses, Undo, pooled RLS context, transport authentication and transfer. The populated migration regression copies data, identity bindings and receipts into the first applied schema, applies the forward migration twice, compares all transferred records and original journal checksum, replays the exact request and verifies another user cannot read it. The same operation ID can be committed independently for another user.

`pnpm test:postgres`: 25 passed, no failures/skips. `pnpm check`: lint/typecheck and all 554 tests passed with no failures, cancellations, skips or TODOs. `pnpm build` passed. `pnpm test:node:built` passed readiness, assets, session, CSRF, write, exact replay and widget checks against the built Node process and real local PostgreSQL. Documentation schema/reference lint and `git diff --check` passed. These are local PostgreSQL results; no hosted migration or rollout has been performed.

The read-only scope audit observes the entire pre-existing dirty worktree, including infrastructure work, historical change packages and user image files. It therefore reports unrelated out-of-scope paths and unresolved source classification for files such as Dockerfile. This is not reported as a clean scope verdict; those existing changes and images were not discarded or included in a deployment.

The final negative type-import fixture also uses `UserActionStore`; `pnpm test:harness` passed all 34 tests after that fixture-only correction. PostgreSQL transfer tests additionally assert version 2/user_id output and rejection of a rehashed version-1 manifest.

Sibling Lore implementation verification: final typecheck/build/lint passed; 129 unit tests passed with two pre-existing skips, and 31 real PostgreSQL integration tests passed. Separate populated forward-migration, snapshot restoration/deletion-ledger reconciliation and encrypted portability checks passed. These sibling results do not represent hosted deployment acceptance. Migration tests preserve arbitrary user JSON and NULL values while changing only defined provenance paths; an unknown view dependency rejects and rolls back the migration.

The two Lore skips are existing PostgreSQL 18 Keycloak mapper maintenance tests, requiring IDENTITY_MAPPER_TEST_ADMIN_URL and Keycloak source-DB configuration: unsupported-disposable-DB rollback/admission and pinned-Keycloak mapper baseline/apply/retry/reverse/readback. They do not close that identity-maintenance boundary. Current user-identity migration and normal PostgreSQL contracts were executed.

## Deployment

After explicit user deployment authorization, Weave's hosted PostgreSQL migrated to `0002_user_identity.sql` through Cloud Run execution `action-store-migrator-np79b`. The original journal checksum and normalized full-table hashes matched before/after migration. The hosted runtime role passed Unicode, exact replay, isolation, CAS, Undo and pooled-RLS checks; synthetic rows were removed and all table hashes rechecked. Pre-migration and post-migration backups succeeded. Both existing jobs now use the recorded immutable release digest. See [deployment evidence](evidence/deployment-weave.json) and its source manifest.

Weave's API service is not deployed: Gate connection implementation and Web OAuth client configuration remain unavailable. No placeholder authentication, public access expansion or D1 cutover was introduced. Hosted DB/Job success is not hosted API/MCP/Web acceptance. All transient DB credential files were removed.

Lore deployed revisions `lore-api-00002-pkv` and `lore-worker-00002-bww` from one immutable image. Migration 0041 and reapplication passed; 42 normalized table hashes and all 40 prior migration checksums matched. Ledger reconciliation was already-current with zero replay/purge. Nine hosted HTTP checks passed; automatic scaling, queue and Scheduler returned to their original values. IAM and identity were preserved. See [Lore deployment summary](evidence/deployment-lore-summary.json) and the primary sibling release record referenced there. Normal-user OAuth/MCP positive-path acceptance remains unverified; external /healthz returned 404, while DB/GCS-backed /readyz returned 200.

## Commit preflight

The commit hook detected overlapping design source ownership. Policy ownership now covers pure logic/UI, application orchestration and boundary lint; service infrastructure owns server/adapters, the store port, PostgreSQL migrations and execution tooling; the action model retains the schema declaration. The read-only ownership-conflicts.v1 query passed with no findings after this documentation correction. No hook was disabled.
