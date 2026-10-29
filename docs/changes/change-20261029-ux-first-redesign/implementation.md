---
change: change-20261029-ux-first-redesign
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

## Data and service

`operationSummary` in `lib/domain/core.ts` validates the optional summary. `actionCall` accepts it on the five action write tools, where it is already part of the canonical payload, and passes it to `UserCommitRequest.summary`. The PostgreSQL store writes it to `state.operations.summary`; the memory fake records it and the D1 adapter returns null.

Provenance stays outside the persisted Action DTO. The PostgreSQL store reads the four provenance columns with the Action rows and splits them into `Snapshot.action_provenance`, and reads `state.client_names` into `Snapshot.client_names`. `persist` adds the committer to changed Action rows; its upsert updates only the `updated_by_*` columns, so creators survive updates, cascades and Undo. `response` in `lib/domain/operations.ts` projects `created_by`/`updated_by` with resolved names only when the snapshot carries provenance.

Gate verification reads an optional valid `client_name` into `GatePrincipal.clientName` without affecting verification; `Principal.clientName` carries it for bearer connections and is null for browser sessions. The commit upserts it into `state.client_names` after the revision check when it differs.

`RecentChangeWindow` and the optional `readRecentChanges` store port read newest-first operations with their result and undoing operation. `pageRecentChanges` in `lib/data/model/change-cursor.ts` validates the range and contiguity and projects records; `undoAvailability` in the application applies the pure `undo` to a fresh snapshot. Feed types moved to `lib/data/types.ts` so UI modules can use them type-only. Migration `0010_change_review.sql`, the runtime schema check, `grantRuntime` and transfer version 8 cover the schema.

## UI

`model/navigation.ts` adds `now` and `changes` review views without an outline and renames the History label to Done & dropped. `model/now.ts`, `model/changes.ts` and `model/date-input.ts#quickDates` are pure projections. `application/changes.ts` owns recent-change loading, stale-response protection, paging, filter and the review mark through `ReviewMarkPort`; `effects/review-mark.ts` implements it with browser storage and a memory fallback. Components `now-panel.ts`, `changes-panel.ts` and `change-cards.ts` render model data with injected nodes and callbacks. The collaboration panel is reused for "Waiting on you" with the new `needsPerson` filter.

The controller gains `undoOperation`, which reuses the serialized write lane, and an `accepted` view hook so the DOM adapter can reload review data after confirmed snapshots. The capture text is interaction view state. The DOM adapter composes the panels, the view rail and quick dates, and lands on Now. The widget markup adds the rail, review sections, status labels, explanations, quick dates and provenance fields, and its stylesheet applies the redesigned tokens and layout.

## Release impact

Apply migration 0010 and rerun runtime grants before starting the new image; the previous image rejects the new journal. Transfer files must be exported and imported by the same release. Gate's introspection change can be released before or after; until then client names show as "Connected app". Refresh tool discovery for `summary` and `list_recent_changes`. The review mark is browser-local and not migrated.
