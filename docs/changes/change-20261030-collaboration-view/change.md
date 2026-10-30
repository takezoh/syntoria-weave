---
id: change-20261030-collaboration-view
kind: change
title: Replace Now with a Collaboration Action list, status icons, view titles and
  a favicon
status: draft
created: '2026-10-30'
profile: sdd@1
intent: 'The owner chose to drop the Now dashboard: every view is an Action list,
  Collaboration lists the Actions an AI is involved in with their status as icons,
  Add stays in the header, and upcoming deadlines are a perspective rather than a
  fixed seven-day panel. The owner also asked for a favicon and a considered window
  title.'
outcomes:
- The rail lists Collaboration instead of Now; it is an Action list of Actions with
  collaboration records, with suggested new work above it.
- Each Action row with collaboration records shows its most urgent status as one named
  icon in an attention, accent or muted tone.
- The widget lands on Inbox; the Now capture box, digest, flagged and seven-day deadline
  panels are removed.
- The window title is the view name with the waiting count; the web shell appends
  an optional appName from runtime configuration.
- The SPA ships SVG and PNG favicons and an Apple touch icon.
- Recent changes reload on every confirmed revision so the Changes badge stays current
  without a review view.
scope:
- lib/ui/**
- lib/widget.ts
- web/**
- scripts/deployment/runtime-config.mjs
- scripts/render-runtime-config.mjs
- tests/ui/**
- tests/harness/runtime-config.test.mjs
- PRODUCT.md
- ARCHITECTURE.md
- docs/technical/ui-architecture.md
- docs/technical/infrastructure-runbook.md
- docs/design/design-ui-visual-policy.md
non_goals:
- Due-date range predicates for perspectives.
- Server-side changes to collaboration records or the API.
- Putting Action text in the window title.
- Deployment.
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261030-collaboration-view/requirements.md
  required: true
- role: implementation
  path: changes/change-20261030-collaboration-view/implementation.md
  required: true
- role: verification
  path: changes/change-20261030-collaboration-view/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- {type: conformsTo, target: design-ui-visual-policy}
- {type: dependsOn, target: change-20261030-dense-icon-first-ui}
source_paths: []
summary: Collaboration Action list replaces Now; one collaboration status icon per
  row; Inbox landing; view-based window titles with an optional configured app name;
  favicon.
---

## Summary

On 2026-10-30 the owner replaced Now with a Collaboration Action list, asked for collaboration status icons on rows, and requested a favicon and a considered window title. Add stays in the header and upcoming deadlines become a perspective sorted by due date; perspectives cannot yet filter by a due-date range.

## Closure Notes
