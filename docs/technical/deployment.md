# Deployment and operations

See the executable paths and provider prerequisites in the [infrastructure runbook](infrastructure-runbook.md).

## Environment contract

Each environment has one independent Cloud Run API service, a dedicated Neon PostgreSQL database and separate database roles, a Gate resource, a Gate browser app and a separately hosted static SPA, version-pinned secrets, a private Artifact Registry repository, Terraform state, backups and monitoring. The API image serves no SPA files. Local development serves the built static SPA; local identity fixtures are not deployed identity acceptance. Do not share production data or credentials with staging/CI. Use [infrastructure operating values](infrastructure.md#resource-configuration).

Production resources use their product prefixes: Cloud Run `weave-api`, Artifact Registry `weave`, service accounts `weave-<role>`, jobs `weave-migrator`/`weave-backup`, secrets `weave-<purpose>`, and backup bucket `weave-backups-example-project`. The shared GCP project remains `example-project`. API, Gate and SPA origins, browser redirect URIs and the shared cookie parent are operator-provided runtime inputs and are absent from tracked files. Registered browser app ID, browser resource client ID and resource introspection client ID are configured separately. MCP public client IDs are issued through DCR.

Configuration is explicit and validated before startup:

| Configuration | Meaning |
| --- | --- |
| PUBLIC_ORIGIN, OAUTH_ISSUER, OAUTH_RESOURCE | Exact HTTPS API origin, Gate issuer and resource=PUBLIC_ORIGIN+/mcp |
| SHARED_COOKIE_DOMAIN, SPA_ORIGINS | Normalized shared-cookie parent and exact credentialed CORS origins; API, Gate and SPA hosts are constrained to this parent |
| GATE_BROWSER_CLIENT_ID | Resource browser client used in Gate session introspection; verified subjects require an explicit enabled local user mapping |
| CURSOR_EPOCH | Nonsecret deployment UUID, stable for releases and rotated for cutover/timeline restore |
| WRITE_MODE | blocked or enabled; defaults to blocked until release acceptance |
| CLIENT_WRITE_APPROVAL | auto or blocked; defaults to auto. Approval policy for writes from client connections (bearer tokens); the person's browser-session writes need no approval |
| DATABASE_URL secret version | Primary direct TLS endpoint and limited runtime role |
| GATE_RESOURCE_CLIENT_ID, GATE_RESOURCE_CLIENT_SECRET secret version | Gate server-to-server authentication for bearer and shared-session validation; no secret values in artifacts or Terraform |
| Runtime limits | Pool=5, concurrency=20, max instances=3, role cap=40 and validated total DB capacity >=64 |
| Schema range | Minimum/maximum compatible migration journal version for this artifact |
| Backup/alert settings | Authorized bucket, retention, alert recipients and environment budget thresholds |

All entry points enforce WRITE_MODE before dispatching a mutation; reads, status lookup and metadata remain available. No header or argument bypasses the fence. The control is a release/configuration effect, not a business field or user override. A maintenance rejection returns a bounded retryable error without fabricating an operation receipt. In-flight commits remain unknown until settled; a new fence does not roll them back retroactively.

CLIENT_WRITE_APPROVAL applies after WRITE_MODE, only to mutations whose verified credential is a bearer client connection (`actor_kind` `client`). `auto` approves each one at once; `blocked` refuses it with 403 `client_write_denied` and writes no receipt, while reads stay available. Changes made inside an AI host's embedded UI travel over that client's connection and are governed by this policy. No header or argument changes the actor kind.

Every API response carries `Strict-Transport-Security: max-age=31536000`, without `includeSubDomains`.

## Reproducible build and IaC

Use Node 24 LTS and package.json's pinned pnpm with frozen installation. `pnpm check` and `pnpm build` must verify the actual Node/PostgreSQL implementation, including boundary suites; inspect their paths instead of treating command names as proof. The build emits two artifacts: `dist/server` for the API container and `dist/spa` for independent static hosting. The container copies only `dist/server` and required licenses. Copy the operator-owned input to `infra/.local/deployment.json`, then run `pnpm render:runtime-config`; the renderer writes the SPA folder with `/runtime-config.json` and the service, migrator and backup Cloud Run manifests under `.local/`. The tracked templates in `infra/cloud-run/` carry only placeholder project values (`example-project`, `123456789012`); the input's `project`, `projectNumber` and `backupBucket` supply the namespace, service accounts, image registry project and backup bucket, so production identifiers stay out of tracked files. These outputs are ignored by Git and Docker and must be delivered through separate runtime/static-host configuration. Serve `/runtime-config.json` with `Cache-Control: no-store`; hashed assets may use immutable caching. A multi-stage container runs as a non-root user with production dependencies and contains no local settings, database dumps, credentials, fixture routes or mock authentication. Tag for discoverability and deploy by immutable image digest.

Terraform modules own state/bootstrap references, IAM/WIF, Artifact Registry, Cloud Run, secret containers, jobs, backup Scheduler and GCS buckets, monitoring, and GCP resource configuration. Neon and Gate settings follow the explicit provider prerequisites in the runbook. Use separate environment state. GCS state is private, versioned and locked; it contains no runtime secret values. Never execute untrusted pull-request code with deployment credentials.

Secret-returning operations (Neon role passwords, Gate resource-client credentials) run in a redacting bootstrap/rotation step outside Terraform resource state. Immediately write generated values as Secret Manager versions; retain only public IDs and version references. Terraform imports/manages only safe nonsecret surfaces that cannot export those values into state. Pin providers, test this property on actual plans/state, and fail if a provider leaks a secret. Runtime identity reads only its listed versions; migrator/backup have separately scoped versions. WIF restricts repository, environment and ref, and no service-account JSON key is installed.

## Credential rotation

Rotate runtime DB passwords under WRITE_MODE=blocked: drain requests, stop/restart all revisions that use the role, install the new secret version/password, and validate access before reopening writes. Do not assume an existing role can accept two password versions or that multiplying roles leaves the connection budget unchanged. Preserve exact unknown requests for reconciliation. Gate resource credential rotation uses a validated overlap or a bounded revision rollout; keep browser app IDs, exact redirects, subject mappings and cookie-parent settings aligned across Gate, API and static hosting. Secrets are pinned by version for deterministic rollout/recovery.

## Migration jobs and compatibility

Run migrations once as a Cloud Run job using the same immutable release image but a separate migrator identity/DB role. Protect the checksummed `schema_migrations` journal with a transaction advisory migration lock. Ordinary transactional DDL and journal updates commit together. For a nontransactional operation, declare its separate guarded step and recovery state explicitly; do not mark it complete on partial failure. API startup checks its supported schema range and fails readiness on incompatibility; scale-out never runs migrations.

The PostgreSQL migration role must have `BYPASSRLS` or superuser status for migrations that update retained rows in FORCE-RLS state tables. Migration 0007 checks this before changing the schema/history and aborts transactionally when the role cannot see all operation deltas. Keep this privilege on the dedicated migrator identity; the runtime role must remain unable to bypass RLS. Logical transfer is version 6 after migration 0007: imports reject version 5 exports. Re-export from the migrated source before transferring data, then verify metadata and retained deltas before opening writes on the target.

Use additive expand/contract releases when revisions overlap. Schema removal follows verification that no serving revision depends on removed objects. Release concurrency is one per environment. Do not automatically reverse a schema migration when rolling back an image. Database constraints, encoded text values and identity grants are part of compatibility testing.

## Initial data cutover

1. Rehearse with synthetic data in staging. Confirm real PostgreSQL, identity, HTTP/MCP/Web, replay, Undo, feed, connection budgets and restore behavior against the candidate image.
2. Inventory source identities, actual data schema/history and in-flight unknown operations without logging content. Configure explicit (issuer,subject)->stable user mapping. Preserve the user strings already associated with records; never merge by email.
3. Block all source business writes across every transport. Wait for in-flight work and resolve or document unknown requests by exact IDs. Confirm a test mutation is rejected and revision watermarks no longer advance; do not assume a UI shutdown fences other callers.
4. Obtain a transaction-consistent export of logical tables and retained operation/history/identity markers. Encrypt it and compute a manifest of counts, IDs, user revision watermarks, association/reference counts, canonical request/result/delta hashes and export digest. Keep raw content outside shared source/logs.
5. Create the PostgreSQL schema in an isolated target with WRITE_MODE=blocked. Import in a transaction using the exact scalar codecs. Do not run destructive data resets. Validate decoded equality, graph invariants, ordered operations, names and marker generations. A failed import rolls back; do not open a partial target.
6. Configure the same stable API/resource identity used for client registration. Rotate CURSOR_EPOCH. Verify explicit subject mappings, exact SPA origins and Gate session resource bindings. Validate authentication rejection and read-only HTTP/MCP/Web on the actual target. Require full client snapshot resync while retaining unsaved proposals and unknown operation IDs.
7. Set target WRITE_MODE=enabled once. Perform a bounded synthetic-user write/replay/Undo check, then switch normal clients. Keep source writes fenced. Record cutover timestamp and final source/initial target watermarks. Never enable both writers.

Before target writes begin, a failed cutover can discard the unserved target and reopen the unchanged source after verifying its fence/watermarks. After target writes, the source is stale: rollback requires a validated reverse data transfer under a fence or roll-forward repair. Changing routing alone is unsafe. Resource retirement is a separate operation after acceptance and backup verification.

## Normal release

Full releases include both the API and the separately hosted SPA. An API deployment alone does not deliver UI changes or complete a full release. If an explicitly scoped API-only release leaves the SPA unchanged, record its serving deployment version and source, verify compatibility with the new API, and state that no UI update was delivered.

1. Check source and run all required suites; run `pnpm build` and build and publish the immutable container from the same evaluated source commit. Retain source, artifact digest, config/IaC revision and proposed schema range. Preserve the matching `dist/spa` output for the static deployment.
2. Apply reviewed environment configuration with redacted outputs. Install explicit secret versions; validate issuer/resource/origin, grants, region and connection budget.
3. Run the migrator once and inspect its terminal result/journal. On failure leave traffic unchanged and report the concrete state.
4. Deploy a no-traffic revision using the configured PUBLIC_ORIGIN, then run startup/schema and authenticated smoke checks. A tagged URL is not an alternative token audience or trusted Origin; invoke transport with the configured API identity.
5. Shift traffic gradually for compatible releases and observe error/latency/pool metrics. Pin all serving revisions to the same CURSOR_EPOCH. Releases involving an incompatible schema or identity/cursor change use a fenced cutover, not a canary across incompatible protocols.
6. Publish the SPA: after the candidate build, run `pnpm render:runtime-config` with the reviewed operator-owned settings, then deploy the resulting `.local/spa` directory to Cloudflare `weave-web` using its existing operator-owned static-host configuration. Follow the [static hosting procedure](infrastructure-runbook.md#dns-and-static-hosting). Building or rendering alone does not publish anything. Retain the provider deployment version and a SHA-256 manifest of the final published files, including runtime configuration and hosting rules.
7. Verify the public SPA over HTTPS: retrieve `/`, `/auth-return.html`, `/workspace.html`, `/runtime-config.json` and each referenced asset, and compare the decoded response-body SHA-256 values with the corresponding candidate files. For `/`, compare with `index.html`. Check cache headers, framing headers (`X-Frame-Options` and `frame-ancestors` on `/` and `/workspace.html`), exact Gate redirect and credentialed CORS. A successful HTTP status or provider deployment receipt is insufficient; resolve any stale CDN response or content mismatch before acceptance. In the authenticated deployed Web UI, exercise the changed behavior; for Action text view/edit changes, verify that an existing Action opens in View and Edit/Done switches the text controls. Preserve unsaved proposals during verification.
8. Validate direct authenticated HTTP, stateless MCP discovery/read, Web UI and negative authorization. Actual MCP client/UI checks are separate from server transport success. Record API and SPA deployment status, source/artifact identities and actual verification results separately. A full release remains incomplete if SPA publication or public content/behavior verification is missing or fails; report all unverified surfaces explicitly.

## Backup and restoration

Production uses a 7-day Neon PITR window and nightly consistent encrypted logical exports retained in private GCS for 30 days. Use a dedicated export role with all-row SELECT policies and pg_dump --enable-row-security; verify count/digest manifests and never run exports under a user-filtered API role. Jobs have timeout/retry limits and a single-run guard; partial uploads are not successful backups. Alert on job failure or backup age >26 h.

Monthly rehearsal: restore a selected backup/PITR point into an isolated DB; validate checksums, schema, all decoded rows, references, receipt/delta continuity and Undo fixtures. Reapply the current operator-maintained disabled-subject manifest, then verify unauthorized access remains rejected. Browser sessions remain Gate-owned and are checked online on every API request. An administrative revocation writes and verifies its versioned control record before applying the DB change; only completion of both is reported as successful revocation. Authorization revocations are recorded outside the DB backup timeline in a private versioned control artifact; restoration without that current manifest is blocked. No public personal information is stored in it.

For a production restore, fence and drain API writes, preserve the incident export, restore to an isolated target, validate and reconcile authorization, rotate CURSOR_EPOCH and runtime credentials as required, then change connection configuration and reopen traffic. Clients must refetch full state and reconcile unresolved requests before resuming; restoring a DB can lose acknowledged updates, so do not silently replay a stale proposal. Logical-backup targets are RPO <=24 h and RTO <=60 min; PITR may provide a newer recovery point but is not a zero-loss promise. Record actual times and data-loss scope.

## Release evidence

A release record binds source commit, image digest, build/suite results, IaC/configuration revision, secret version references (never values), schema journal/checksums, Cloud Run revision, endpoint, timestamp, access scope and actual verification results. For the SPA, also retain its source commit, Cloudflare deployment version, final file SHA-256 manifest, public URL/hash comparisons, cache-header checks and authenticated browser behavior results. Record these independently of API image/revision evidence; for an API-only release, identify the retained SPA version and compatibility result. Report server correctness, deployed identity, browser operation, MCP client/host behavior and latency separately. No local fake or document validation is hosted acceptance.
