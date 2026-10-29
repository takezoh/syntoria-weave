---
id: change-20261029-proposal-selection-events
kind: change
title: Select and edit three retained proposals and notify MCP clients of changes
status: active
created: '2026-10-29'
profile: sdd@1
intent: Let the person choose and edit proposals, and let connected AI clients observe
  UI decisions without treating notifications as execution permission.
outcomes: []
scope:
- lib/
- db/
- tests/
- scripts/
- docs/
- ARCHITECTURE.md
- PRODUCT.md
- skills/action-tools/
non_goals:
- AI auto-start or external execution authorization
- Automatic deployment of this revision
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261029-proposal-selection-events/requirements.md
  required: true
- role: implementation
  path: changes/change-20261029-proposal-selection-events/implementation.md
  required: true
- role: verification
  path: changes/change-20261029-proposal-selection-events/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations: []
source_paths: []
summary: Allow up to three editable proposals per action, retain cancelled approvals,
  and stream user-state change notifications to authenticated MCP subscribers.
updated: '2026-10-29'
---

## Summary

Allow the person to choose and edit up to three retained proposals, cancel approval without removing proposals, and let connected Remote MCP clients observe UI changes through standard resource notifications.

## Closure Notes

Implementation is verified locally. Deployment and actual client notification acceptance are outside this package's current delivery. No external execution or Gate authorization logic is added.
