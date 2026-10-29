---
change: change-20261029-security-hardening
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

`package.json` requires fastify ^5.12.7 and no longer lists zod; `lib/connector-errors.mts`, its only importer, was referenced nowhere. `pnpm-workspace.yaml` overrides `fast-uri@<3.1.9` to ^3.1.9, inside ajv's `^3.0.1` range, because the lockfile otherwise kept 3.1.7. The Fastify `onRequest` hook adds HSTS beside its existing no-store and nosniff headers.

`spaHostingRules` in `scripts/deployment/runtime-config.mjs` is the single source of `_headers` and `_redirects`; `scripts/render-runtime-config.mjs` writes them into `.local/spa`. `/workspace.html` removes the inherited framing headers and allows `'self'`, because `index.html` frames it. The SPA keeps its runtime `<meta>` Content-Security-Policy, which cannot set `frame-ancestors`.
