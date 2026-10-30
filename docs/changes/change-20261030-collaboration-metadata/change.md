---
id: change-20261030-collaboration-metadata
kind: change
title: Keep caller metadata separate from collaboration text
status: draft
created: '2026-10-30'
profile: sdd@1
intent: The owner asked that AI collaboration data, like an Action's Notes and Metadata,
  separate caller-managed metadata from the text shown to the person, which renders
  as Markdown.
outcomes:
- propose_collaboration and every update_collaboration command, including adopt, accept
  optional exact-text metadata; omission keeps it and an empty string clears it.
- Reads, history, receipts, identical replay and transfer carry metadata; it never
  changes the decision or progress a command records.
- Migration 0012 states empty metadata for existing heads and history without rewriting
  stored text; transfer version 10 requires it.
- The UI and the copied request never contain metadata; tool schemas describe human-facing
  fields as Markdown.
scope:
- lib/data/types.ts
- lib/domain/collaboration.ts
- lib/application/collaboration-service.ts
- lib/mcp/collaboration-definitions.ts
- lib/adapters/postgres/migrations.ts
- lib/adapters/postgres/transfer.ts
- db/postgres/migrations/0012_collaboration_metadata.sql
- tests/**
- skills/action-tools/references/collaboration.md
- skills/action-guide/references/capabilities.md
- docs/technical/**
- docs/design/assistance.md
- docs/design/design-ui-visual-policy.md
non_goals:
- Separate metadata for proposals and reports.
- Showing, searching or validating metadata content.
- Production deployment or migration.
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261030-collaboration-metadata/requirements.md
  required: true
- role: implementation
  path: changes/change-20261030-collaboration-metadata/implementation.md
  required: true
- role: verification
  path: changes/change-20261030-collaboration-metadata/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- {type: conformsTo, target: design-ui-visual-policy}
- {type: references, target: design-assistance}
- {type: dependsOn, target: change-20261030-dense-icon-first-ui}
source_paths: []
summary: Collaboration records gain exact-text metadata written by any command, preserved
  when omitted and never shown in the UI; migration 0012 and transfer version 10.
---

## Summary

Collaboration records gain caller-managed `metadata`, written by any command and kept when omitted, beside the human-facing proposal and report text that the UI renders as Markdown. Migration 0012 and transfer version 10 carry it. Nothing is committed or deployed.

## Closure Notes
