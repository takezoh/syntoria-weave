---
id: change-20261022-action-text-view-mode
kind: change
title: Action Title and Notes view and edit modes
status: draft
created: '2026-10-22'
profile: sdd@1
intent: Show Action Title and Notes as readable structured text with links by default,
  and require an explicit Edit transition before raw text editing.
outcomes:
- Action details open Title and Notes in view mode with structured rendering and safe
  host-opened links; raw HTML is never interpreted.
- An explicit Edit/Done toggle switches the raw inputs; new local Actions start and
  stay in edit mode through identity confirmation.
- Proposal retention, autosave, IME and unknown-outcome guarantees are unchanged.
scope:
- lib/ui/**
- lib/widget.ts
- web/client.ts
- tests/ui/**
- ARCHITECTURE.md
- PRODUCT.md
- docs/technical/ui-architecture.md
- docs/technical/mcp-api.md
non_goals:
- Changes to stored Title/Notes values, the action API, persistence or Project/Tag
  description editing.
- Rich text editing, full CommonMark/GFM conformance, tables, images or raw HTML.
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261022-action-text-view-mode/requirements.md
  required: true
- role: implementation
  path: changes/change-20261022-action-text-view-mode/implementation.md
  required: true
- role: verification
  path: changes/change-20261022-action-text-view-mode/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations: []
source_paths:
- lib/ui/model/rich-text.ts
- lib/ui/components/rich-text.ts
- lib/ui/components/inspector-panel.ts
- lib/ui/model/view-state.ts
- lib/ui/application/controller.ts
- lib/ui/effects/dom.js
- lib/widget.ts
- web/client.ts
summary: Action Title and Notes render as structured text with safe links by default;
  explicit Edit exposes raw inputs.
---

## Summary

Title and Notes in Action details default to a rendered view. A pure Markdown-subset model produces typed data that the component renders with DOM nodes only. An explicit Edit control exposes the raw inputs; Done flushes and returns to view. Links open through the host `ui/open-link` request.

## Closure Notes
