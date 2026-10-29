---
id: change-20261029-security-hardening
kind: change
title: Harden dependencies, HTTPS and SPA framing
status: draft
created: '2026-10-29'
profile: sdd@1
intent: Close the dependency, HTTPS and framing findings of the 2026-10-29 security
  review without changing application behavior.
outcomes:
- Production dependencies audit clean; fastify 5.12.7, fast-uri at least 3.1.9, and
  the unused zod dependency and module removed.
- Every API response carries Strict-Transport-Security max-age=31536000.
- The SPA renderer writes _headers and _redirects with framing protection, so no page
  except the workspace inside its own shell can be framed.
scope:
- package.json
- pnpm-lock.yaml
- pnpm-workspace.yaml
- lib/connector-errors.mts
- lib/server/node/server.ts
- scripts/deployment/runtime-config.mjs
- scripts/render-runtime-config.mjs
- tests/**
- docs/technical/**
non_goals:
- includeSubDomains or HSTS preload.
- A full Content-Security-Policy response header for the SPA; the shell keeps its
  runtime meta policy.
- Publishing the SPA or deploying the API.
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261029-security-hardening/requirements.md
  required: true
- role: implementation
  path: changes/change-20261029-security-hardening/implementation.md
  required: true
- role: verification
  path: changes/change-20261029-security-hardening/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations: []
source_paths: []
summary: Clean production audit, API HSTS, and generated SPA hosting rules with framing
  protection.
---

## Summary

fastify moves to 5.12.7; a scoped override lifts fast-uri under ajv to ^3.1.9 within ajv's own range; zod and the unreferenced `lib/connector-errors.mts` are removed. The API adds HSTS. `spaHostingRules` generates `_headers` and `_redirects`, which the renderer now writes instead of the operator reapplying them by hand. Nothing is committed or deployed.

## Closure Notes
