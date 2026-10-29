---
id: change-20261029-ux-first-redesign
kind: change
title: Organize the UI by intent and let the person review what AI changed
status: draft
created: '2026-10-29'
profile: sdd@1
intent: The owner adopted a UX-first redesign and all of its data proposals. The UI
  opens on what needs the person and lets them review and undo what AI and other
  connected apps saved, instead of starting from data-type lists.
outcomes:
- The UI lands on Now (capture, what waits on the person, recent connection changes,
  flags, deadlines) and adds Changes (retained saves newest first with per-save Undo).
- Writes accept an optional caller summary stored with the operation and shown as
  the writer's claim beside the actual changes.
- Actions carry display provenance of their creator and latest changer; connected
  clients are shown by their unverified registration name relayed by Gate.
- list_recent_changes reads retained operations newest first with advisory Undo status.
- The person's review mark is kept per browser.
scope:
- lib/data/**
- lib/domain/core.ts
- lib/domain/operations.ts
- lib/domain/assistance.ts
- lib/application/**
- lib/adapters/**
- lib/server/node/principal.ts
- lib/server/node/gate-verifier.ts
- lib/server/node/authentication.ts
- lib/mcp/tool-definitions.ts
- lib/ui/**
- lib/widget.ts
- db/postgres/migrations/0010_change_review.sql
- tests/**
- skills/action-tools/**
- PRODUCT.md
- ARCHITECTURE.md
- docs/technical/**
- docs/usage/agent-workflows.md
non_goals:
- Ranking, recommending or hiding actions on Now.
- A server-stored review mark or read receipts for AI consumers.
- Verifying client names, or naming browser sessions.
- Planned dates, priority scores or other new management fields.
- Production deployment, migration or Gate release.
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261029-ux-first-redesign/requirements.md
  required: true
- role: implementation
  path: changes/change-20261029-ux-first-redesign/implementation.md
  required: true
- role: verification
  path: changes/change-20261029-ux-first-redesign/verification.md
  required: true
promotion: []
unresolved_decisions:
- Whether to move the review mark to user-scoped server storage for cross-device use;
  that needs its own decision record because it would add a person-acknowledgment state.
tags: []
owners: []
relations: []
source_paths: []
summary: Now and Changes views, caller summaries, Action provenance, client names via
  Gate and newest-first recent history; review mark per browser.
---

## Summary

On 2026-10-29 the owner asked for a UX-first redesign, reviewed the design canvas and its data proposals, and adopted all of them, choosing to change Gate as well so that client names can be shown. The UI now lands on Now and adds Changes. The data layer adds caller summaries on operations, display provenance on Actions, a user-scoped table of client names and a newest-first recent-history read, through migration 0010 and transfer version 8. Gate relays the client's registration name in introspection in its own change `change-20261029-introspection-client-name`. Nothing is committed or deployed.

The review mark follows the adopted staged proposal: it stays in browser storage first, and a server-side mark is left as an unresolved decision.

## Closure Notes
