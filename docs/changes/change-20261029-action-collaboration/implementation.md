---
change: change-20261029-action-collaboration
role: implementation
---

# Implementation

`lib/domain/collaboration.ts` owns deterministic proposal validation and state transitions. Action lifecycle remains in the existing action domain. A collaboration has a nullable action link, proposal version, business decision, reported progress, next actor, run identity/provenance, outcome and evidence. Revised proposals reset the run only after running work and unknown outcomes are resolved.

`lib/application/collaboration-service.ts` exposes list/get/propose/update through the existing application entry. It obtains identity, time and IDs from ports; it performs receipt lookup before ID allocation and revision checks. Adoption uses the existing action transition and commits the linked record atomically. Generic Undo cannot reverse collaboration decisions; explicit decision transitions retain their history.

Migration `0007_collaboration.sql` adds user-scoped heads and immutable event history with FORCE RLS. The PostgreSQL adapter commits user CAS, changed action rows, collaboration head/history, receipt and pruning in one transaction. Collaboration history retains canonical input and receipt data after normal receipt pruning. No automatic collaboration-history retention policy is installed. Transfer manifest version is 6 and includes both tables; old-format imports require explicit conversion using a reviewed process.

The four tools are `list_collaborations`, `get_collaboration`, `propose_collaboration` and `update_collaboration`. Snapshot capability is `collaboration_version:1`. Existing five-collection action deltas remain unchanged: consumers refresh collaboration snapshots when revision changes. History is paginated in batches of 50.

The UI controller uses its existing write and unknown-result recovery lane. Pure projection controls decisions; readonly components receive callbacks; DOM adapters own clipboard/link effects. The action detail provides an assistance request and linked current work. The overview includes new proposals and retained declined/withdrawn records. Copying a handoff does not launch an agent. The UI displays the latest 50 history entries; complete history is available through the paginated API.

Gate remains the authentication and authorization authority. This change adds no local grants, effect admission policy, runner, background job, notification or execution lease. Run provenance protects report integrity within shared state, not external execution. Any authorized writer can record a business decision; it is not cryptographic evidence of human approval for an external effect.
