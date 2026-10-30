---
change: change-20261030-collaboration-metadata
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

Local working tree on 2026-10-30, together with `change-20261030-dense-icon-first-ui`; not committed or deployed.

- `tests/domain/collaboration.test.mjs`: default empty, exact text including NUL, lone surrogates and emoji, omission keeps it through accept, start and report set and clear it without changing their outcome, assign changes nothing else, non-strings and oversized text fail, and stored records without it fail validation (FR-001–FR-003, FR-005).
- `tests/postgres/collaboration-metadata.test.mjs` (real PostgreSQL 17): migration 0012 on a 0011-era head and history adds empty metadata and leaves text containing `"metadata":` untouched; over the application and real adapter, propose stores it, identical replay returns the receipt, a changed value under the same ID is `idempotency_conflict`, defer keeps it, revise and assign set and clear it, oversized text fails, history keeps each value, another user sees nothing and transfer exports version 10 (FR-002, FR-004, FR-005, FR-INV-001). Over Node HTTP/MCP with the synthetic Gate, discovery advertises `metadata`, an AI's MCP write stores it, the browser API returns it, a person's browser decision keeps it and another user's MCP read is empty.
- `tests/postgres/collaboration-delegation.test.mjs`, `transfer.test.mjs` and `user-identity-migration.test.mjs`: the 0011 migration result now also states empty metadata; transfer version 10 round-trips and versions 4–9 are rejected.
- `tests/ui/collaboration.test.mjs`: metadata stays in the snapshot but not in the card text, markup, parsed card text or copied request (FR-006).

## Repository gates

- Final `pnpm check` with both changes: lint, typecheck and 685 tests passed, with no failures, cancellations, skips or TODOs.
- `pnpm build` passed, including the plugin artifact verification. `pnpm test:node:built` passed against the built server and real PostgreSQL, including its collaboration check.

## Limitations

Hosted Neon migration, Cloud Run, the deployed Gate and real MCP clients are not exercised; rollout follows [deployment](../../technical/deployment.md#collaboration-metadata-rollout).

## Production release

On 2026-10-30, source `0ec4f24` (with `efcc9c6`), pushed to main as a fast-forward, was released together with `change-20261030-dense-icon-first-ui` and `change-20261030-collaboration-metadata` as revision `weave-api-dense-0ec4f24` with image `sha256:506e4553d82ac4b2bc80f103876d82c175da92f0af2638a0c9146a27357b5e7f` (Docker Buildx, linux/amd64). See the [release evidence](../../evidence/20261030-dense-ui-release/release.json).

- Backup execution `weave-backup-brwp7` failed with the previous image, as the nightly backups do while the backup role cannot read `state.client_names`. The recovery point is Neon PITR at 2026-10-30T07:32:19Z, recorded immediately before migrating. Migrator execution `weave-migrator-fpcb7` applied 0012 with the release image; a read-only check (`weave-migrator-rmqdw`) found the journal at 0012 and metadata stated in all 20 collaboration heads and 24 history bodies.
- The new revision passed its startup schema check and a no-traffic tagged liveness and readiness probe before receiving 100% traffic; the tag was removed. The previous revision logged nothing at warning or above between migration and the switch. Migrator and backup jobs now use the release image.
- Public checks after the switch: readiness 200, MCP with an invalid bearer 401 with a challenge, an untrusted-origin preflight 403, the SPA-origin preflight 204 with its exact origin and credentials, protected-resource metadata 200, an unauthenticated session 401.
- The static SPA is version `b0d3f5e2-ecac-4b08-974c-fb3cd0370702`, published right after the API switch because the new widget requires collaboration metadata and the previous one rejects it; only `workspace.html` changed. All seven public files matched the candidate hashes with the expected cache, framing and credentialed CORS headers ([asset manifest](../../evidence/20261030-dense-ui-release/asset-manifest.json), [public checks](../../evidence/20261030-dense-ui-release/public-verification.json)).

Not verified in production: authenticated Web UI behavior in a real browser, hosted MCP reads and writes of collaboration metadata, ChatGPT widget rendering (a widget the host cached before this release rejects snapshots with collaboration metadata until it refetches the resource), and a backup after migration. The zero-traffic tagged revision `weave-api-collab-3f3a6848` from an earlier release keeps failing its startup schema check, as it did before this migration.
