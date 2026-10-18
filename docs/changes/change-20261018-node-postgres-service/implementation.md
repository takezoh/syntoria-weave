---
change: change-20261018-node-postgres-service
role: implementation
---

# Implementation

## Responsibility and source

`lib/server/node/` owns validated configuration, request capability issuance, Auth0/OIDC and session authentication, Fastify transport and production composition. `lib/mcp/dispatcher.ts` reuses the generic tool registry while excluding verification-only discovery. `web/` hosts the existing shared widget and owns session renewal and HTTP relay; the widget is not replaced with a separate business implementation.

`lib/adapters/postgres/` owns TLS pools, real transaction isolation, owner advisory locks and forced RLS, row codecs, changed-row persistence, identity bindings, checksummed migrations and administrative transfers. Bulk row writes use bounded parameterized chunks in one transaction. Free text is encoded as JSON string cells, UUID spelling is retained and API integers stay in the safe range. Reads do not create owner records. Application/domain transitions are shared rather than duplicated per transport.

`db/postgres/migrations/0001_state.sql` defines state and identity constraints and owner policies. Runtime privileges exclude table ownership, BYPASSRLS and all-owner export. Transfer validates graph and receipt continuity before commit; failed imports leave the target empty. Administrative commands never silently reassign an existing subject's owner.

`scripts/build-node.mjs`, `Dockerfile` and the CI container job produce/check the Node service and the separate migration/backup entries. Production dependencies are limited to the Node transport, authentication and validation/database libraries; UI/build frameworks remain development dependencies. The backup holds its exported snapshot for the bounded job, streams pg_dump into private storage and publishes a manifest only after successful subprocess completion and upload. `infra/` declares GCP resources, least-privilege runtime/job identities, WIF, secret containers/references, monitoring, backups and resource budgets. Neon/Auth0 prerequisites are explicit in the runbook; this Terraform does not provision those providers.

## Operational boundaries

No remote environment is created or modified. CI checks source and container builds; publishing and traffic changes follow the reviewed environment release procedure. PostgreSQL JSON transfer is implemented, but conversion from a different source storage format is not silently inferred. Migration, secret installation, provider configuration, data cutover and hosted acceptance require an actual environment and evidence. Existing applied SQL migration artifacts are preserved.
