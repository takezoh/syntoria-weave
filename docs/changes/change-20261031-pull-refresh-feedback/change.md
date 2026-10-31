---
id: change-20261031-pull-refresh-feedback
kind: change
title: Keep pull-to-refresh motion and loading feedback continuous
status: active
created: '2026-10-31'
profile: sdd@1
intent: Make pull-to-refresh motion and pending-read feedback coherent while preserving
  the existing refresh path.
outcomes: []
scope:
- lib/ui/
- lib/widget.ts
- tests/ui/
- docs/technical/ui-architecture.md
- docs/technical/testing.md
non_goals: []
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261031-pull-refresh-feedback/requirements.md
  required: true
- role: implementation
  path: changes/change-20261031-pull-refresh-feedback/implementation.md
  required: true
- role: verification
  path: changes/change-20261031-pull-refresh-feedback/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- {type: conformsTo, target: design-ui-visual-policy}
source_paths: []
summary: A content track reveals an icon during pull, holds it during refresh, and
  restores without overlaying rows.
updated: '2026-10-31'
---

## Summary

The user confirmed that refresh executes but its label alone moves over stationary rows. Separate pull presentation from contact arbitration and read coordination so content follows the contact and feedback survives until the read settles.

## Closure Notes

Local implementation, regression checks and independent review are complete. Native device acceptance remains open.
