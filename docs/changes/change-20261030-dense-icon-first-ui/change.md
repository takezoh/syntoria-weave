---
id: change-20261030-dense-icon-first-ui
kind: change
title: Dense icon-first UI with separate List and Detail pages
status: draft
created: '2026-10-30'
profile: sdd@1
intent: 'The owner adopted the Action Detail and app redesign canvas: icon-only controls,
  no explanatory copy, dense property chips, Markdown collaboration text and separate
  List and Detail pages on narrow widths.'
outcomes:
- Action Detail shows one icon-only toolbar row, the title, property chips with inline
  Deadline and Hide until editors, Notes, the Work with AI card and one activity line.
- Collaboration cards render human-facing proposal and report text as Markdown and
  place each decision in a model-assigned slot.
- Wide layouts use an icon-only view rail with number badges and single-line rows
  with icon badges.
- Narrow layouts show Action List and Action Detail as separate pages and restore
  the list position on Back.
scope:
- lib/ui/**
- lib/widget.ts
- tests/ui/**
- docs/technical/ui-architecture.md
- docs/design/design-ui-visual-policy.md
non_goals:
- Caller-managed collaboration metadata; it is a separate storage contract change.
- Changing Action, collaboration or write semantics, autosave, recovery or Undo.
- Compact Now attention rows replacing full collaboration cards.
- Production deployment or host acceptance.
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261030-dense-icon-first-ui/requirements.md
  required: true
- role: implementation
  path: changes/change-20261030-dense-icon-first-ui/implementation.md
  required: true
- role: verification
  path: changes/change-20261030-dense-icon-first-ui/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- {type: conformsTo, target: design-ui-visual-policy}
- {type: modifies, target: design-ui-visual-policy}
source_paths: []
summary: Icon-first toolbar and property chips in Action Detail, Markdown collaboration
  cards with decision slots, icon rail and compact rows, Now headers, and List/Detail
  pages on narrow widths.
---

## Summary

On 2026-10-30 the owner asked for an Action Detail redesign, then for icon-only controls without explanatory text, dense use of the panel, separate List and Detail pages on phones and Markdown collaboration text, and adopted the resulting design canvas for the whole app. This change implements the presentation. Caller-managed collaboration metadata is a separate storage change, `change-20261030-collaboration-metadata`.

## Closure Notes
