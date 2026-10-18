---
id: change-20261015-batch-write-context
kind: change
title: Batch write receipt and current state reads
status: active
created: '2026-10-15'
profile: sdd@1
intent: Reduce sequential D1 waits during writes and exact replay without weakening
  current-state, atomicity and recovery contracts.
outcomes:
- Remove one sequential storage acquisition from ordinary writes and identical replay
  while preserving current-state and recovery contracts.
scope:
- lib/application/
- lib/adapters/d1-action-store.ts
- tests/helpers/
- tests/application/
- tests/adapters/
- docs/technical/data-model.md
- docs/technical/testing.md
non_goals:
- Geographic placement, deployment, infrastructure, schema or public API changes.
- UI previews, partial snapshots, response slimming and hosted latency claims.
change_classes:
- internal_design
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261015-batch-write-context/requirements.md
  required: true
- role: implementation
  path: changes/change-20261015-batch-write-context/implementation.md
  required: true
- role: verification
  path: changes/change-20261015-batch-write-context/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- {type: conformsTo, target: design-effect-boundaries}
source_paths: []
summary: Coalesce owner receipt and snapshot acquisition to remove one sequential
  D1 wait per write or replay.
updated: '2026-10-15'
---

## Summary

The write path now batches receipt and current-state acquisition. Ordinary writes remove one of four sequential storage calls; identical replay removes one of two. Public responses, post-commit refresh, CAS, replay, Undo and owner boundaries are preserved. This is the first bounded non-geographic improvement under Issue #31; response slimming, UI round trips and production latency measurement remain outside this unit.

## Closure Notes

The local implementation and independent review are complete. The change remains active pending source integration; no commit, deployment, hosted acceptance or completion of the broader Issue #31 is claimed.
