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
