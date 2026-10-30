---
id: change-20261030-mobile-interaction-ownership
kind: change
title: Unify mobile screen, gesture and refresh ownership
status: active
created: '2026-10-30'
profile: sdd@1
intent: Restore coherent mobile screen, gesture and refresh ownership without browser-specific
  covering patches.
outcomes: []
scope:
- lib/ui/
- lib/widget.ts
- tests/ui/
- docs/technical/ui-architecture.md
- docs/technical/testing.md
non_goals:
- Backend and storage changes
- Invented safe-area dimensions
- Claiming actual-device acceptance from browser emulation
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261030-mobile-interaction-ownership/requirements.md
  required: true
- role: implementation
  path: changes/change-20261030-mobile-interaction-ownership/implementation.md
  required: true
- role: verification
  path: changes/change-20261030-mobile-interaction-ownership/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations: []
source_paths:
- lib/ui/model/screen.ts
- lib/ui/model/list-gesture.ts
- lib/ui/application/refresh.ts
updated: '2026-10-30'
---

## Summary

Replace competing mobile event and screen handlers with explicit screen projection, a single gesture arbiter and a coalesced application refresh lane. Preserve ordinary native scrolling, desktop split inspection and unsaved or unknown-operation state.

## Closure Notes

Implementation and local verification are complete. Actual iOS Home Screen acceptance remains open; this package does not claim that the translucent compositor layer is fixed.
