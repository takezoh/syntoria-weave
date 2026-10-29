---
id: change-20261029-plugin-collaboration-guidance
kind: change
title: Align ChatGPT plugin guidance with collaboration and host notification support
status: active
created: '2026-10-29'
profile: sdd@1
intent: Align installed plugin knowledge with current proposals and distinguish server
  notification support from host delivery.
outcomes: []
scope:
- plugins/action-tools/plugin.json
- skills/action-tools/
- skills/action-guide/
- tests/mcp/cloud-plugin.test.mjs
- tests/postgres/application-user-scope.test.mjs
non_goals: []
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261029-plugin-collaboration-guidance/requirements.md
  required: true
- role: implementation
  path: changes/change-20261029-plugin-collaboration-guidance/implementation.md
  required: true
- role: verification
  path: changes/change-20261029-plugin-collaboration-guidance/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations: []
source_paths: []
summary: Update the plugin to 1.1.0 with bundled proposal operations and accurate
  ChatGPT event guidance.
updated: '2026-10-29'
---

## Summary

Align both bundled skills and package metadata with current proposal decisions and client-host notification boundaries.

## Closure Notes
