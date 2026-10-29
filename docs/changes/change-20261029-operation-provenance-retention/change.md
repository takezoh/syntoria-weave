---
id: change-20261029-operation-provenance-retention
kind: change
title: Record operation clients and retain history by period
status: draft
created: '2026-10-29'
profile: sdd@1
intent: Let the user see which connected client made each change and undo any AI change
  from the last 30 days, instead of losing Undo after 100 operations; no approval
  step is added.
outcomes:
- Each operation records the verified OAuth client that committed it, exposed in the
  change feed and preserved by transfer, as provenance only.
- Operation history is retained for 30 days per user, never fewer than the latest
  100 and never more than the latest 5000, pruned only as an oldest prefix.
scope:
- lib/data/**
- lib/adapters/**
- lib/application/ports.ts
- lib/domain/assistance.ts
- lib/mcp/tool-definitions.ts
- db/**
- skills/**
- tests/**
- PRODUCT.md
- ARCHITECTURE.md
- docs/technical/**
- docs/design/product.md
- docs/usage/agent-workflows.md
non_goals:
- Approval or confirmation of AI changes; per-client authorization, grants or limits.
- Backfilling client IDs for operations committed before migration 0005.
- Production deployment or migration.
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261029-operation-provenance-retention/requirements.md
  required: true
- role: implementation
  path: changes/change-20261029-operation-provenance-retention/implementation.md
  required: true
- role: verification
  path: changes/change-20261029-operation-provenance-retention/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations: []
source_paths: []
summary: Client provenance on operations and 30-day history bounded by 100 and 5000
  operations, instead of approvals.
---

## Summary

On 2026-10-28 the owner decided that Weave does not ask the user to approve AI changes. Instead it records which client made each change and keeps operation history long enough that every AI change of the last 30 days can be reviewed and undone. The change replaces the fixed latest-100 history with period retention bounded by 100 and 5000 operations, adds `client_id` provenance through migration 0005, and moves the transfer format to version 4. Nothing is committed or deployed.

## Closure Notes
