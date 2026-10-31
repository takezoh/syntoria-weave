---
id: change-20261031-responsive-scroll-ownership
kind: change
title: Unify responsive scroll ownership and readable perspective navigation
status: active
created: '2026-10-31'
profile: sdd@1
intent: Make named navigation readable and keep chrome stationary on tablets without
  width-dependent scroll ownership.
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
  path: changes/change-20261031-responsive-scroll-ownership/requirements.md
  required: true
- role: implementation
  path: changes/change-20261031-responsive-scroll-ownership/implementation.md
  required: true
- role: verification
  path: changes/change-20261031-responsive-scroll-ownership/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- {type: conformsTo, target: design-ui-visual-policy}
source_paths: []
summary: One layout owner bounds all viewports and gives lists, detail and named navigation
  their own scroll areas.
updated: '2026-10-31'
---

## Summary

Separate responsive placement from viewport and scrolling ownership. A single layout module bounds chrome and content at every width, and named perspectives no longer inherit icon-button dimensions.

## Closure Notes

Local geometry, interaction and regression checks passed. Native hardware acceptance and the diagnostic Chromium Escape behavior remain explicitly unverified.
