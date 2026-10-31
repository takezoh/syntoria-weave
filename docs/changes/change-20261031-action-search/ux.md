---
change: change-20261031-action-search
role: ux
---

## Adopted direction

Global title and notes across every Action including deferred/completed/dropped; exclude Project/Tag records, metadata, collaboration records and hidden IDs.

Trim query edges, apply Unicode NFKC and lowercase to query and each field, and match the whole normalized query as a literal contiguous substring within title OR notes. Empty/whitespace query shows no search results. No token operators, fuzzy, accent folding or cross-field concatenation.

Unique flat Action rows in existing canonical action-tree order, without inserting nonmatching parents. Keep existing state badges and parent/catalog context.

Visible header magnifier with accessible Search name and tooltip opens/focuses named search input; icon clear empties query; Escape closes search when not composing and returns focus to Search; selecting navigation exits to that destination. Close restores previous navigation settings.

Match visible title/notes draft overlays and local nonempty Action proposals as the user currently sees them; invalid raw drafts stay intact. Existing inspector remains reachable when its edited row stops matching.

UAC-001: Given Inbox hides a deferred Action and history contains completed/dropped Actions, when searching a literal found in their title or notes, then all matching records appear once with correct lifecycle/defer cues; a nonmatching parent and metadata-only match do not appear.

UAC-002: Given title contains ＡＢＣ and notes contain Mixed Case, when searching abc or mixed case with outer spaces, then the respective Action matches; whitespace-only query yields no results. A literal punctuation query is not interpreted as regex/operators; matches do not span title/notes boundaries.

UAC-003: Given a nondefault Project/Tag/perspective selection and display choices, when opening search, typing, opening a result and returning from narrow Detail, then the query/result context survives; closing search restores the previous view and choices, with drafts intact.

UAC-004: Given an unsaved raw title/notes/date, catalog draft or collaboration proposal/feedback, when searching, clearing, selecting another result or navigating away/back, then those exact values remain. A title edit may remove its row from matches, but the open editor remains reachable and its text is not discarded.

UAC-005: Given an unknown write and its exact request, when entering search and receiving a host refresh, then recovery remains visible/reachable, no duplicate write is created, and lookup/replay retains operation ID and exact arguments. Search never clears conflicts, proposals or recovery-required state.

UAC-006: Given keyboard/screen-reader use, when activating Search then entering text, then focus reaches a named input and result availability is announced without moving focus on every keystroke. Clear and close have accessible names; result activation opens existing Detail; Escape during IME composition does not close or commit composition.

UAC-007: Given no matches, then a short No results state distinguishes empty results from stale/loading/failure. Given initial load or refresh failure, then the existing error/retry and retained snapshot remain visible and the query is retained; unavailable snapshot is never announced as a successful zero match.

UAC-008: Given matching actions in multiple Tag occurrences, then search lists each Action once in canonical order, and opening/selecting it targets that Action. Filtered result selection must not claim invisible rows are selected or allow ambiguous drop destinations.

UAC-009: Given refresh changes persisted text or status, then current query reapplies to the latest accepted snapshot plus retained drafts; stale refresh does not replace newer state, and no lifecycle/date/order/revision changes occur solely from search.

UAC-010: Given compact desktop and narrow touch layouts, then Search/input/clear fit the existing toolbar and available width, existing save/recovery remains reachable, input does not create horizontal overflow, and mobile Detail remains a separate page.

The main implementation session adopted these reversible defaults under the user’s request to design and implement search. The requirements producer supplied the candidate; its independent skill evaluation did not complete because the documentation scaffold changed the bound tree. Design and implementation verification must independently assess these scenarios.

## User confirmation

On 2026-10-31 the user explicitly replied “承認” to the proposed independent global Action title/Notes search, including deferred, completed and dropped actions, width/case normalization and draft retention. The primary alternative is confirmed.

## Specification review

The confirmed Specify candidate in [requirements-specification.json](requirements-specification.json) passed independent review. The requirements loop reached SUCCEEDED with all required obligations satisfied. This establishes the UX contract, not implementation or host acceptance.
