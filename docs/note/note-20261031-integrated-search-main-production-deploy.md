---
id: note-20261031-integrated-search-main-production-deploy
kind: note
title: Integrated search main production deployment
status: draft
created: '2026-10-31'
tags: []
owners: []
relations:
- {type: references, target: change-20261031-action-search}
source_paths: []
summary: Integrated main API and SPA deployed at full traffic; public checks passed,
  authenticated and host acceptance remain unverified.
---

## Scope

The user requested deployment of the integrated main source `945a93e72f6d83fc698222ad1484308c04594269`. This source combines Action search with main's responsive screen, scroll, gesture and contextual feedback changes, preserves Search input focus across deferred list restoration, and keeps the mobile header reachable from Detail. The earlier search-only deployment is recorded separately.

## Validation

The exact implementation passed lint, typecheck, all 758 tests with zero failures/skips/TODO, and local narrow/wide Chromium acceptance before publication to main. Deployment rebuilt the static SPA and clean-archive API container, and reran built Node/PostgreSQL acceptance successfully, including sessions, CSRF, replay, MCP, revocation and outage behavior. The matching migration job completed without a schema change; the candidate API revision passed startup readiness before traffic changes.

## Acceptance boundary

Public file/hash, cache/framing-header, readiness, unauthenticated rejection and credentialed CORS checks are recorded with the rollout outcome below. Authenticated browser and HTTP/MCP acceptance and actual ChatGPT resource retrieval/cache behavior remain unverified because no authenticated verification session was available. No production Action data was written for acceptance. Public transport checks and prior synthetic acceptance do not close these boundaries.

Actual deployment identifiers, provider receipts, image digest, source commit, settings and secret-version readbacks, file SHA-256 manifest and public verification results are retained in ignored `.local/main-release/`. This tracked record excludes deployment identifiers.

## Rollout outcome

Both API and static SPA publication completed. API traffic reached 100% on the candidate after a 10% stage, with the previous revision retained. After the final switch, all 11 public content paths matched the candidate hashes; runtime configuration had no-store caching, hashed assets had immutable caching, and document/workspace framing headers passed. Readiness returned 200, unauthenticated session and MCP requests returned 401, and credentialed CORS preflight returned 204 with the exact origin. The new revision had zero error entries at the bounded observation. Deployment is complete; full authenticated/host release acceptance remains incomplete as described above.
