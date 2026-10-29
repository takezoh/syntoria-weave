---
change: change-20261029-security-hardening
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

Local working tree on 2026-10-29; not committed, published or deployed.

- `pnpm audit --prod`: no known vulnerabilities (before: 1 high, 5 moderate, 5 low).
- `tests/harness/runtime-config.test.mjs`: the generated rules contain the framing, nosniff, referrer, cache and rewrite rules exactly. The renderer run in a scratch directory with the example input wrote `_headers` and `_redirects` beside the SPA files.
- `tests/postgres/server.test.mjs`: the protected-resource metadata response carries HSTS.
- `pnpm lint`, `pnpm typecheck` and `pnpm build` passed; `pnpm test`: 593 passed, 0 failed, skipped or TODO.
- Not verified: Cloudflare's handling of the `!` header-removal syntax for `/workspace.html` on the deployed host; check it in the release's public header verification.
