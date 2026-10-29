---
change: change-20261029-application-user-scope
role: verification
---

# Verification

- pnpm check: passed, 628 tests, zero failures, cancellations, skips or TODOs; lint and TypeScript passed.
- pnpm build: passed.
- Real PostgreSQL migration acceptance covers fresh, metadata-pending and metadata-applied schemas using a NOSUPERUSER/NOBYPASSRLS owner, repeat migration, original journal preservation, checksum rejection and exact Unicode notes in multiple users' retained deltas.
- Store tests deliberately reuse object and operation IDs between users and check reads, edits, deletion, receipts, Undo rejection and feed isolation without RLS. PostgreSQL collaboration and HTTP/MCP event tests use the RLS-disabled schema and verify cross-user and cross-connection access boundaries.
- Existing competition, replay, missing response, Undo, transfer and authenticated HTTP suites remain in the combined harness.
- pnpm test:node:built: passed, including authenticated HTTP, sessions, collaboration, MCP events, revocation and outage.

## Hosted release

On 2026-10-29, source `8bff54b2e69250602740f2178ec0d58f89c646a0` was released after merging remote main. Image digest: `sha256:00fc63f90d08ae975c615411aad628e3abffdfa9139f1619b37698df9c2e1bcb`. Private deployment identifiers, source/asset manifests, readbacks and provider execution results are retained under ignored `.local/release-application-scope/`.

- Backups completed before the migration under the write fence and after the migration using the updated backup artifact.
- The schema-owning migrator applied 0008 and 0009 with superuser and BYPASSRLS both false. All ten state tables have row security disabled and no row policies remain. Runtime and backup privilege levels were not elevated.
- API and SPA artifacts reached 100% traffic; normal writes were restored. Runtime environment and secret references were retained except for the temporary WRITE_MODE fence.
- Authenticated reads before and after migration preserved revision 522, all 160 Actions and both proposals, allowing only the expected new empty metadata field. Exact replay through the enabled write route retained the same state.
- Direct authenticated Remote MCP resource subscription, SSE notification and resource read succeeded. Public SPA file hashes, runtime configuration cache policy, API readiness, unauthenticated rejection and credentialed CORS passed.
- Interactive browser approval and third-party MCP host notification delivery were not exercised. Cross-user isolation is established by local real PostgreSQL/HTTP tests; no additional production users were provisioned for this release.
