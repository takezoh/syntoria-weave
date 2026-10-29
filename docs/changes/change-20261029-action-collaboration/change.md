---
id: change-20261029-action-collaboration
kind: change
title: Share proposals, decisions and execution reports around actions
status: active
created: '2026-10-29'
profile: sdd@1
intent: Keep human actions independent while sharing versioned proposals, work decisions,
  handoffs and actual run reports across authorized clients.
outcomes: []
scope:
- lib/
- db/
- tests/
- scripts/lint/boundaries.mjs
- scripts/testing/verify-node-built.mjs
- docs/
- ARCHITECTURE.md
- PRODUCT.md
- skills/action-tools/SKILL.md
non_goals:
- Replacing Gate authentication or authorization
- External effect grants, AI scheduling or automatic execution
- Hosted deployment
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261029-action-collaboration/requirements.md
  required: true
- role: implementation
  path: changes/change-20261029-action-collaboration/implementation.md
  required: true
- role: verification
  path: changes/change-20261029-action-collaboration/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations: []
source_paths:
- lib/domain/collaboration.ts
- lib/application/collaboration-service.ts
- lib/adapters/postgres/action-store.ts
- lib/ui/model/collaboration.ts
- lib/ui/components/collaboration-panel.ts
updated: '2026-10-29'
summary: Implemented shared proposals, business decisions and observed reports without
  replacing Gate or external runners; local checks pass and hosted deployment remains
  outside scope.
---

## Summary

Implemented shared proposals, business decisions, caller-reported progress and outcomes alongside ordinary actions. Accepted scope is not Gate authorization and does not launch an agent. Human action completion remains independent.

## Closure Notes

Local implementation and automated verification are the delivery scope. Hosted migration and actual-client acceptance remain deployment work. See the package implementation and verification members for boundaries and evidence.
