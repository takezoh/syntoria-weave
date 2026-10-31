---
id: change-20261031-search-default-active
kind: change
title: Search defaults to unfinished nondeferred Actions
status: draft
created: '2026-10-31'
profile: sdd@1
intent: Default Search to unfinished nondeferred Actions while retaining local opt-in
  display controls and unsaved proposals.
outcomes:
- Search returns active/on-hold nondeferred matches by default and exposes the existing
  opt-in lifecycle/Defer controls.
- Search display changes preserve the current query, inspector and unsaved proposals
  without reads or writes.
scope:
- lib/ui/model/navigation.ts
- lib/ui/model/view-state.ts
- lib/ui/model/outline.ts
- lib/ui/effects/dom.js
- tests/ui
- ARCHITECTURE.md
- docs/technical/ui-architecture.md
- docs/technical/testing.md
non_goals:
- Backend/schema/persistence changes
- New Search-specific filter controls or state
- Changes to caller-side behavior
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261031-search-default-active/requirements.md
  required: true
- role: implementation
  path: changes/change-20261031-search-default-active/implementation.md
  required: true
- role: verification
  path: changes/change-20261031-search-default-active/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations: []
source_paths: []
summary: Search defaults to active and on-hold nondeferred results with optional lifecycle
  and Defer choices
---

## Summary

Global Search now starts with the unfinished, nondeferred Action set. Existing Display choices opt into completed, dropped and deferred matches. Search filter changes remain local and preserve query and proposals.

## Closure Notes
