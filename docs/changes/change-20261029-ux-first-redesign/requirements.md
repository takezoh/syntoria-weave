---
change: change-20261029-ux-first-redesign
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

## Data

- FR-001: When an action write tool (`add_action`, `rename_action`, `capture_intent`, `apply_change`, `undo_change`) receives `summary`, Weave shall accept only nonempty trimmed-visible text of at most 500 UTF-16 code units, store it exactly with the operation, and return it in `get_changes` and `list_recent_changes`. It shall not change what is saved.
- FR-002: `summary` shall be part of the canonical request: identical replay returns the receipt and a different summary under the same operation ID is `idempotency_conflict`.
- FR-003: When an operation commits through the PostgreSQL store, every changed Action row shall record the verified committer as its latest changer, and a newly inserted row shall also record it as its creator. Existing creators are kept; rows saved before this change stay unknown.
- FR-004: Snapshots from stores that record provenance shall carry display-only `created_by` and `updated_by` on each Action; they shall not enter persisted Action DTOs, deltas, Undo comparisons or feed records.
- FR-005: When a client connection writes and Gate relayed a valid `client_name`, Weave shall record it for that user and client ID in the commit transaction. Reads and browser sessions shall never record names. Snapshots and change reads shall resolve `client_name` from that record.
- FR-006: `list_recent_changes` shall return retained operations below `before_revision` (or from the head), newest first, at most `limit` (1–50, default 20), with `undone_by`, `collaboration_id`, `next_before_revision` and an advisory `undo.status` computed by the pure Undo rules against a current snapshot. It shall reject gaps and malformed history, and a store without the capability shall return `unavailable`.
- FR-INV-001: Summaries, provenance and client names are display data: no authorization, user selection, grant or Undo rule shall read them.
- FR-INV-002: Every new read and write shall stay user-scoped; the same client ID or operation ID under another user shall not be visible.

## UI

- FR-101: The UI shall land on Now, which shows a capture box, collaboration records waiting on the person, recent changes by connections, flagged normal-view Actions and unfinished Actions with a deadline passed or within seven days, without ranking or hiding Actions.
- FR-102: Saving from the capture box shall call `capture_intent` with the first visible line as the title and the exact text as Notes. The text shall remain until the save is confirmed; an unknown outcome shall keep it and the exact request for check or identical retry.
- FR-103: Changes shall list retained saves newest first, grouped by local day, with who made each save (you, a connected app's name or unknown), the writer's summary labelled as its claim, plain-language lines derived from persisted before/after records, and Undo when available or the reason it is not.
- FR-104: Undo from Changes shall use the serialized write lane with a new operation ID, the current revision and the exact `undoOf`, and shall refresh the list after the confirmed result.
- FR-105: "Mark as reviewed" shall record the loaded head revision in this browser only; later connection changes shall count as new. A mark beyond the head shall be ignored. Reading changes shall never set the mark.
- FR-106: The inspector shall label lifecycle choices Open, Waiting, Done and Dropped with a short explanation, call Defer "Hide until" and Due "Deadline" with quick dates using the existing inputs, and show who added and last changed the Action when known.

Counterexamples: a summary that changes saved data or is accepted when blank; a retry with an edited summary under the original ID being applied; the Undo of an Action overwriting its creator; provenance appearing in a feed delta; a name written by a read or a browser session; a client name or summary used for access; a recent page with a gap reported as complete; Now ordering by importance or omitting unfinished deadlines; capture text cleared on an unknown outcome; Undo from Changes retried with a new ID after a lost response; a review mark sent to the server or set by reading.
