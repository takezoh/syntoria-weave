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
- Hosted migration and deployment evidence will be recorded separately. Local fixtures are not hosted acceptance.
