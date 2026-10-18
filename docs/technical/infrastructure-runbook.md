# Service infrastructure runbook

## Source and local verification

Use Node 24 and the pinned pnpm. Run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build` and `pnpm test:node:built`. The last command starts an isolated PostgreSQL 17 instance and the built Node process, exercises session-authenticated HTTP writes and exact replay, fetches the shared widget, and removes its synthetic database. It needs no provider credentials. `pnpm test:postgres` includes actual SQL, RLS, concurrency, rollback, retention, identity and transfer tests.

Build the production image with `docker build -t action-tools:local .`. The non-root image includes Node 24 and PostgreSQL 18 client tools and system CA certificates for the separate backup job. libpq uses `PGSSLROOTCERT=system` with hostname verification; retain the system trust store in the runtime image. CI verifies source and container builds; publishing and deployment require the environment-specific release process below.

## Provider and secret preparation

Prepare separate staging and production environments. In Neon configure a PostgreSQL 18 project in `aws-ap-southeast-1`, a primary read/write endpoint, compute 0.25–1 CU, no production autosuspend, and seven-day restore history. Verify the actual plan supports these values and exposes at least 64 usable server connections. Do not use a transaction-pooling endpoint for the runtime or backup. Create distinct migrator, runtime and export logins. The runtime must neither own tables nor bypass RLS nor inherit the export role. The migrator must own application tables and be allowed to grant the required privileges. Keep passwords out of command arguments, tracked files and Terraform variables.

In Auth0 register the canonical `${PUBLIC_ORIGIN}/mcp` API audience, RS256 tokens, `state:read` and `state:write` scopes, and the confidential regular Web application. Register only `${PUBLIC_ORIGIN}/auth/callback` as its callback. Enable authorization code and S256 PKCE. Register API/MCP clients explicitly; no dynamic client registration or public signup is provided. Grant only approved subjects and clients. The Web client uses OIDC identity and server-side grants rather than browser-stored API tokens.

These provider settings are operator-managed prerequisites; the checked-in Terraform manages GCP resources and does not create Neon or Auth0 tenants. A saved design is not evidence that either provider is configured.

Create a private, versioned GCS Terraform-state bucket separately from the application backup bucket. Initialize `infra/` with `terraform init -backend-config=bucket=... -backend-config=prefix=...`. Supply a private environment variable file with the declared nonsecret inputs. `terraform plan` must be reviewed before `terraform apply`. Secret Manager containers are declared, but payloads are installed separately and referenced by numeric version. Runtime database, migrator database and export database URLs are distinct secrets. Generate independent random 32-byte base64url login-encryption and CSRF keys. Do not place secret payloads in Terraform state.

Terraform provisions Artifact Registry, the Cloud Run service and migration/backup jobs, service accounts, repository/ref/environment-restricted GitHub WIF, secret access, private backup storage, Scheduler, request/pool/backup-age alerts and budget notifications. The initial immutable image must exist in the selected repository. Bootstrap with writes blocked and the reserved bootstrap origin, then configure the actual canonical origin and matching Auth0 registrations before accepting clients. Health probes are the only requests exempt from the canonical Host check.

## Administrative commands

Build first. Set `ADMIN_DATABASE_URL` through the process environment and run `pnpm db:admin migrate`. Schema migration is checksummed and serialized; server startup only verifies compatibility. Provision login roles through the provider, then run `pnpm db:admin grant-runtime ROLE` and `pnpm db:admin grant-export ROLE`. The latter creates the non-login `action_export` group and all-row read policies. Run these operations using the schema-owning migrator identity, never the runtime identity.

Use `pnpm db:admin grant PRIVATE_MANIFEST` for an array of `{issuer,subject,user,clientId,scopes}` records. User reassignment is rejected. Explicitly review manifests; they contain identity information and must stay outside the repository. Runtime reads cannot create subjects or grants.

`pnpm db:admin export PRIVATE_FILE` writes a transaction-consistent PostgreSQL logical transfer plus a SHA-256/count manifest with mode 0600. It requires all-row export privileges. `CONFIRM_WRITE_FENCE=true pnpm db:admin import PRIVATE_FILE` requires an empty target, checks the digest and graph/receipt continuity, and commits all imported rows atomically. Transient sessions and login attempts are excluded. The transfer uses version 2 with `user_id` columns and rejects other versions. This transfer format is PostgreSQL administrative data; an export from another storage format requires an explicit conversion and decoded-equality rehearsal before use. Never feed a SQL dump to this JSON importer.

`pnpm db:admin snapshot USER PRIVATE_FILE` validates and exports a single decoded snapshot. `CONFIRM_WRITE_FENCE=true pnpm db:admin apply-revocations PRIVATE_MANIFEST` clears sessions/login attempts and disables listed subjects or client grants. Keep the current reviewed revocation manifest in separately versioned private storage before applying it; restore operations require this current control record, not a copy from the backup timeline. Rotate `CURSOR_EPOCH` after restoring or cutting over a timeline.

## Release and recovery

Follow [deployment](deployment.md) for fenced data cutover, compatible rollout, secret rotation and rollback. Run the migration job from the exact candidate image; inspect its terminal result before updating serving traffic. Pin images by digest and secret values by version. Start with `WRITE_MODE=blocked`, verify actual issuer/resource/user boundaries and read-only clients, then explicitly enable writes after acceptance. Do not infer deployed behavior from local fixtures.

The backup job runs `dist/server/backup.mjs`, takes a PostgreSQL snapshot, streams `pg_dump --format=custom --enable-row-security` into private GCS, and uploads its manifest only after the dump and object upload succeed. The separate export-role check prevents a successful but user-filtered export. Partial objects have no successful manifest and are not restore inputs. Restrict the backup identity to object creation; restoration is a separate privileged operation. A missing success log for 26 hours alerts. Verify actual scheduled backups and rehearse `pg_restore` into an isolated database before production acceptance; JSON administrative transfer tests do not establish custom-format dump restoration or measured RPO/RTO.
