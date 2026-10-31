---
id: change-20261031-action-search
kind: change
title: Find actions across states from the shared UI
status: active
created: '2026-10-31'
profile: sdd@1
intent: Find existing actions by human-facing text across lifecycle and deferred states
  without losing edits or recovery context.
outcomes: []
scope:
- lib/ui/**
- lib/widget.ts
- tests/ui/**
- ARCHITECTURE.md
- docs/technical/ui-architecture.md
- docs/technical/mcp-api.md
- docs/changes/change-20261031-action-search/**
- docs/technical/testing.md
non_goals:
- Backend search APIs, schema migrations, deployment, metadata search and saved query
  editing.
change_classes:
- behavior
- internal_design
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261031-action-search/requirements.md
  required: true
- role: implementation
  path: changes/change-20261031-action-search/implementation.md
  required: true
- role: verification
  path: changes/change-20261031-action-search/verification.md
  required: true
- role: ux
  path: changes/change-20261031-action-search/ux.md
  required: false
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- {type: conformsTo, target: design-product}
- {type: conformsTo, target: design-ui-visual-policy}
- {type: conformsTo, target: design-action-state-and-perspectives}
source_paths: []
summary: Approved global local Action Title and Notes search across lifecycle states,
  with shared projection and draft recovery.
updated: '2026-10-31'
---

## Summary

Global Action Title and Notes search is approved. The user's confirmation and independently reviewed requirements/architecture contracts are recorded in the package. Implementation adds local pure matching and a shared controller-owned outline projection without a search API or persistence change. Exact-source local checks, build and final-artifact synthetic browser acceptance pass; host-specific boundaries are recorded in verification.md.

## Closure Notes

Implementation and local acceptance are complete; independent final code review approved the candidate without actionable findings. The package remains active because the repository-wide conformance command raises the documented tooling exception. Formal closure is not claimed. No deployment or actual-host acceptance was requested or performed.
