---
id: change-20261031-detail-header-regression
kind: change
title: Restore mobile Detail header ownership
status: draft
created: '2026-10-31'
profile: sdd@1
intent: Restore narrow Detail header ownership after merge 945a93e removed the shared
  header-hide rule.
outcomes: []
scope:
- lib/ui/components/layout-styles.ts
- tests/ui/dom.test.mjs
- docs/technical/ui-architecture.md
- docs/technical/testing.md
non_goals:
- Backend, schema and API changes
- Adding Search controls to Detail
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261031-detail-header-regression/requirements.md
  required: true
- role: implementation
  path: changes/change-20261031-detail-header-regression/implementation.md
  required: true
- role: verification
  path: changes/change-20261031-detail-header-regression/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- {type: references, target: change-20261030-mobile-interaction-ownership}
- {type: conformsTo, target: design-ui-visual-policy}
source_paths:
- lib/ui/components/layout-styles.ts
- tests/ui/dom.test.mjs
summary: Restore the mobile Detail header contract in shared layout styles and correct
  DOM coverage that contradicted it.
---

## Summary

Restore mobile List/Detail header ownership after merge `945a93e` removed the CSS rule that hid the global header on Action and Catalog Detail. Keep Search in the List header, correct DOM coverage to follow valid narrow navigation, preserve the Search-defaults correction, and verify CSS source ownership plus built browser geometry.

## Closure Notes
