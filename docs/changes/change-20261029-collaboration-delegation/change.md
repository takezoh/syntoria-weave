---
id: change-20261029-collaboration-delegation
kind: change
title: Record who should handle delegated work and let each connection find its own
status: draft
created: '2026-10-29'
profile: sdd@1
intent: Several AIs share the same state. The person records whether any AI or a
  specific one should handle approved work, and each AI finds and is notified of the
  work that concerns it, without Weave restricting who may act.
outcomes:
- Collaboration records carry a delegation target with separate mode (any AI or
  specified AI) and client fields; who handles work is otherwise derived, the person
  by default.
- The assign command changes the target in any state from any actor, recorded in history.
- list_assigned_collaborations and the action-state://assigned resource return a
  connection's work with reasons; subscriptions are per resource and assigned
  notifications follow only that content.
- Collaboration cards show and change the target.
scope:
- lib/data/types.ts
- lib/domain/collaboration.ts
- lib/domain/operations.ts
- lib/application/**
- lib/mcp/**
- lib/server/node/mcp-event-stream.ts
- lib/server/node/mcp-subscriptions.ts
- lib/server/node/server.ts
- lib/adapters/postgres/**
- lib/ui/**
- db/postgres/migrations/0011_collaboration_delegation.sql
- tests/**
- skills/action-tools/references/collaboration.md
- PRODUCT.md
- docs/technical/**
non_goals:
- Rejecting or filtering any write by delegation, including start.
- Changing the existing guards or the 30-day operation history.
- Launching or waking AIs; notifications remain read hints.
- Production deployment or migration.
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261029-collaboration-delegation/requirements.md
  required: true
- role: implementation
  path: changes/change-20261029-collaboration-delegation/implementation.md
  required: true
- role: verification
  path: changes/change-20261029-collaboration-delegation/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- {type: references, target: change-20261029-ux-first-redesign}
source_paths: []
summary: Delegation target as state, the assign command, per-connection assigned work
  and notifications; no enforcement.
---

## Summary

On 2026-10-29 the owner set the principle for multi-AI work: Weave holds state and does not restrict who may act; every AI may edit all data and the history shows when, how and by which AI. An Action is the person's until a proposal is approved or work is requested or delegated. The owner kept the existing guards and history retention. This change adds the delegation target as state, `assign`, the assigned-work read and resource, and per-resource subscriptions with content-based assigned notifications. Nothing is committed or deployed.

## Closure Notes
