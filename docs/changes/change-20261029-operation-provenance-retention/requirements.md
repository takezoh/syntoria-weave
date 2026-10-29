---
change: change-20261029-operation-provenance-retention
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

- FR-001: When an operation commits through the PostgreSQL store, Weave shall record the OAuth client ID of the verified request identity with the operation. Caller arguments shall never supply it.
- FR-002: The change feed shall return `client_id` for each operation, or null when the client is unknown. Transfer shall preserve it.
- FR-002a: Each operation committed through the PostgreSQL store shall record `actor_kind`: `user` when the request authenticated with a Gate browser session in the Weave app, and `client` when it authenticated with a bearer token. The change feed and transfer shall carry it. (Added 2026-10-29 at the owner's request to distinguish human and AI operations.)
- FR-INV-001: No authorization, user selection, grant, Undo eligibility or other rule shall read `client_id` or `actor_kind`; they are provenance only.
- FR-003: After each successful commit, Weave shall keep every operation committed within 30 days of the commit time, always keep the latest 100 operations, and keep no more than the latest 5000.
- FR-INV-002: Pruning shall remove only an oldest prefix of revisions, in the same transaction as the commit, so retained history stays contiguous and change cursors behind it expire with `cursor_expired`.
- FR-004: Receipt replay, `operation_status`, input-conflict detection and Undo shall work for any retained operation, including operations older than the latest 100 within the period.

Counterexamples: a caller supplying a client ID; a client ID granting or denying access; pruning that leaves a revision gap; an operation inside the period lost because more than 100 later operations exist (below the maximum); unbounded history growth inside the period.
