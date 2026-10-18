---
id: change-20261018-gate-authentication
kind: change
title: Gate connection authentication and production readiness
status: draft
created: '2026-10-18'
profile: sdd@1
intent: Use shared Gate connection approval for every bearer and Web request while
  preserving existing user identity and stored data.
outcomes:
- Every protected API and Web request requires online approved Gate connection with
  explicit user mapping.
- Real PostgreSQL and built HTTP tests preserve replay, identity isolation, encrypted
  sessions and revocation.
scope:
- lib/server/node/
- lib/adapters/postgres/identity-store.ts
- lib/adapters/postgres/migrations.ts
- db/postgres/migrations/0003_gate_sessions.sql
- infra/
- tests/
- scripts/lint/boundaries.mjs
- scripts/testing/verify-node-built.mjs
- docs/technical/
- ARCHITECTURE.md
- docs/design/design-service-infrastructure.md
non_goals:
- Signup, organizations, feature scopes, automatic identity merging or client grants.
change_classes:
- boundary
- internal_design
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261018-gate-authentication/requirements.md
  required: true
- role: implementation
  path: changes/change-20261018-gate-authentication/implementation.md
  required: true
- role: verification
  path: changes/change-20261018-gate-authentication/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- {type: modifies, target: design-service-infrastructure}
- {type: conformsTo, target: design-effect-boundaries}
source_paths: []
summary: Online Gate introspection for API and encrypted PostgreSQL Web sessions,
  serialized refresh, full-access approval and data-preserving migration.
---

## Summary

Use shared Gate connection approval for bearer API/MCP and encrypted PostgreSQL Web sessions. Preserve explicit subject/client identity mappings and all business data. Full access follows approval without feature-level OAuth scopes.

## Closure Notes

Local verification is complete. Hosted GitHub/Gate/Firestore/Cloud Run/Neon and external client acceptance are recorded separately by the production rollout.
