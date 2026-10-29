---
change: change-20261029-security-hardening
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

- FR-001: `pnpm audit --prod` shall report no known vulnerability.
- FR-002: Every API response shall carry `Strict-Transport-Security: max-age=31536000`.
- FR-003: The published SPA shall send `X-Frame-Options: DENY` and `frame-ancestors 'none'` for every path except `/workspace.html`, which shall allow only its own origin, together with `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
- FR-004: The renderer shall write the SPA hosting rules, including the existing cache and root rewrite rules, so a release cannot omit them.

Counterexamples: another site framing the signed-in shell; the shell unable to frame its own workspace; a release with `runtime-config.json` cached.
