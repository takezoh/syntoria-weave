---
change: change-20261029-client-write-approval
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

Local working tree on 2026-10-29; not committed or deployed.

- `tests/postgres/server.test.mjs` "client connection writes pass the approval policy while the person needs none": under `blocked`, MCP `apply_change` and bearer `/api/actions` return 403 `client_write_denied` and write no operation, MCP `list_actions` succeeds, and a browser-session write succeeds and is recorded as `user`; after restoring `auto`, the same client write commits and is recorded as `client`.
- `tests/postgres/server.test.mjs` configuration test: default `auto`, `blocked` accepted, other values rejected.
- `pnpm lint` and `pnpm typecheck` passed. `pnpm test`: 592 passed, 0 failed, skipped or TODO; its PostgreSQL group alone: 30 passed.
- The configuration type keeps its own `'auto'|'blocked'` union because the architecture lint forbids `config.ts` from importing the principal capability module.
