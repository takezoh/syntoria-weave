---
change: change-20261018-node-postgres-service
role: verification
---

# Verification

## Executed evidence

- `pnpm check`: 553 tests passed, zero failures, cancellations, skips or TODOs; ESLint and TypeScript passed. Includes real PostgreSQL 17 rather than SQLite substitution.
- PostgreSQL adapter tests exercise concurrent first writes/duplicates, stale revisions, receipt precedence over corrupt graph decoding, exact Unicode round trips, deferred-constraint rollback, Undo, feed/retention, repeatable reads, RLS-context reset, grant revocation during an actual advisory-lock wait, 205-row multi-chunk upsert/delete and simulated loss of an actual COMMIT response followed by exact replay.
- HTTP/MCP tests compose the real PostgreSQL adapter with actual RS256 signature verification using a synthetic local JWKS. Negative tests cover token audience/expiry/signature, unregistered clients, revoked grants, scopes, Host/Origin, cookie/bearer mixing and CSRF. One-time login binding is exercised without contacting Auth0.
- DOM relay verification retains the same iframe and exact arguments after expiration, blocks cross-account replay and rejects foreign-origin messages.
- `pnpm build` passed. `pnpm test:node:built` passed against a separately running built Node process, real HTTP sockets and real PostgreSQL: readiness, hashed assets, session/CSRF, save/replay and widget resource retrieval.
- `terraform -chdir=infra validate -no-color` passed using Terraform 1.13.4 and the locked Google provider; formatting was checked.
- Docker production build passed. The image runs as UID 999, includes Node 24.22.0 and pg_dump 17.11, and retains application, Node and bundled vendor licenses. Production entry imports also pass with development dependencies removed. The final local image is `sha256:05dff851898da2abd9c6808405fc6e2b69e8129b18bf20b60492e132517d4eec` (830,473,179 uncompressed bytes); it is not a published Artifact Registry digest.

## Verification limits

Synthetic session/JWKS tests do not establish deployed Auth0 discovery, authorization-code redirects, HTTPS browser login or actual client installation. No cloud plan/apply, live migration, production-data conversion/import, Neon/Cloud Run measurement, scheduled GCS backup, custom-format restore, provider-plan capacity, RPO/RTO or latency objective is claimed. No independent-agent approval is implied by the main-session checks. Keep deployment writes blocked until the runbook's actual-environment gates pass.

## Change-scope tooling

The global worktree scope query cannot be reported as PASS: it also observes pre-existing design/batching changes and user image files outside this implementation package. Directory declarations were normalized to explicit globs. Its current parser cannot resolve the extensionless root `Dockerfile` declaration. These are recorded limitations; the user images and prior changes were preserved, and the source/build/test checks above do not rely on a scope verdict. `docs conform` for this package and documentation lint passed.

## Deployment preparation after user authorization

The user subsequently requested deployment. The dedicated `action-store` Artifact Registry repository was created in the existing `syntoria` project in Singapore. The verified container was published and its immutable digest read back; see [deployment progress](evidence/deployment-progress.json). No Cloud Run service has been deployed: Weave-specific Neon/Auth0 settings and credentials were not found in the local configuration or existing project secret names. Gateway Neon account discovery returned no aliases. Existing Thymesis and D1 resources remain unchanged. The repository is a bootstrap resource to import into the environment Terraform state before its first full apply; do not attempt to recreate it.

## Supplied PostgreSQL deployment verification

The user supplied `op://local-dev/Syntoria/PostgreSQL`. After CLI session propagation failed, the user provided the value through a mode-0600 temporary file. The supplied endpoint uses PostgreSQL 18.6 in Singapore and a pooler; direct TLS was separately verified. Existing populated databases were left untouched. A new `action_store` database and three dedicated roles were created within the supplied Neon project. Schema, runtime RLS/non-ownership checks and backup policy applicability passed. A bounded synthetic-owner application smoke on the actual hosted PostgreSQL verified Unicode, exact replay, concurrent CAS, Undo and owner isolation; all synthetic rows were removed afterward. This establishes hosted adapter behavior, not deployed HTTP or OAuth acceptance.

The container now includes pg_dump 18.6 to match the supplied server; the PostgreSQL 17 client cannot dump a newer server major ([PostgreSQL documentation](https://www.postgresql.org/docs/current/app-pgdump.html)). The new published image digest and progress are in the deployment JSON. The full local check still passes 553 tests; the local fixture remains PostgreSQL 17 and is reported separately. Compute limits, autosuspend and restore-history configuration were not changed or claimed verified on the shared project.

Backup-role connection credentials were persisted as `action-store-backup-database` version 1. Automatic approval review rejected creating the migration/runtime connection secrets, citing lack of explicit user approval for those payloads/destinations; explicit approval was requested. Their generated credentials remain only in restricted local temporary storage pending that decision. The original 1Password management credential was not sent to GCP. Cloud Run remains undeployed pending this approval and actual Auth0 configuration.

## Approved credential storage and deployed job acceptance

The user explicitly approved the named migration/runtime Secret Manager destinations. Both were created as version 1 and all three DB secret versions were read back as enabled without displaying values. Transient credential files were removed after durable storage and verification. Dedicated migration/backup service accounts have only resource-scoped secret read access; the backup identity has object-creation access to the private dedicated bucket.

The initial backup execution failed. A same-image real Neon pg_dump reproduction established missing system CA certificates: the PostgreSQL image did not provide `/etc/ssl/certs/ca-certificates.crt`, required by `PGSSLROOTCERT=system`. The runtime installs ca-certificates and CI now checks their presence; TLS verification remains enabled. The fixed-image local Neon dump passed. Migration and backup jobs were updated to the same final immutable image; successful executions and digest are recorded in the deployment JSON.

Backup execution was approved after all eleven business/identity tables were independently confirmed empty through the all-row export role. The GCS manifest and dump were fetched, byte count and SHA-256 matched, and pg_restore succeeded in a temporary network-isolated PostgreSQL 18 container. The restored database contained twelve tables, seven forced-RLS state tables, one schema journal entry and zero actions. The temporary restore container was removed. This proves an initial empty-database dump/upload/restore, not populated-data recovery, monthly rehearsal or achieved RPO/RTO. No ongoing backup schedule was configured.

`pnpm check` still passed 553 tests with zero failures/skips/TODOs. The container build passed. API service deployment and actual Auth0/browser/MCP acceptance remain pending real issuer/client configuration. Resource addresses and import identifiers are recorded for adoption into the environment Terraform state before a full apply; no Terraform-managed environment is falsely claimed.
