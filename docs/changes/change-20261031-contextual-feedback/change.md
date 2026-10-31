---
id: change-20261031-contextual-feedback
kind: change
title: Contextual feedback without permanent footer and labelled navigation
status: active
created: '2026-10-31'
profile: sdd@1
intent: Remove idle footer space while keeping labelled navigation, independent read
  feedback, persistent exact recovery and untimed Undo.
outcomes: []
scope:
- Shared UI feedback model, application state, reusable component, DOM integration
  and navigation layout
- Generated UI, pure/controller regression tests and current UI documentation
non_goals:
- Backend, API, database, authentication, deployment-resource and dependency changes
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261031-contextual-feedback/requirements.md
  required: true
- role: implementation
  path: changes/change-20261031-contextual-feedback/implementation.md
  required: true
- role: verification
  path: changes/change-20261031-contextual-feedback/verification.md
  required: true
- role: ux
  path: changes/change-20261031-contextual-feedback/ux.md
  required: false
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- {type: modifies, target: design-ui-visual-policy}
source_paths:
- lib/ui/model/feedback.ts
- lib/ui/components/contextual-feedback.ts
- lib/ui/application/controller.ts
- lib/ui/effects/dom.js
- lib/widget.ts
summary: Labelled navigation and pane-local feedback preserve exact recovery and untimed
  Undo without idle footer space.
updated: '2026-10-31'
---

## Summary

Implement the accepted contextual-feedback contract as one shared UI feature. Standard navigation has visible names, idle footer space is removed, and independent typed read, save and operation state determines pane-local feedback. Exact unknown requests and retained Action/Catalog edits remain accessible; Undo has explicit identity-bound lifetime.

## Closure Notes

Implementation and local checks are complete; independent review and delivery remain with the coordinating agent. The package remains active until that evidence is associated with the released source. Physical iOS, native-device interaction and authenticated deployed-host acceptance are not established by local Chromium or mocked identity. Repository-wide conformance CLI execution is limited by its existing string/object mismatch for design forbidden boundaries; ordinary document lint passes.
