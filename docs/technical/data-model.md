# Data model and consistency

Neon PostgreSQL is the durable store. This document defines the logical model and persistence contract.

## Data and management policy

The model represents shared state used by the human and authorized AI consumers: everyday actions, original notes, containment, classifications, dates and saved perspectives. The API calls the saved entity action. User prompts and caller-side LLMs interpret that state and choose GTD or other management conventions; classification names and descriptive text do not impose a method or become executable policy. Caller-side collection and scheduling write through the same user-scoped operations as conversation and UI. Weave validates data integrity, not an external management routine.

## Durable records

| Table | Key | Content |
| --- | --- | --- |
| actions | user, id | title, notes, metadata, lifecycle status, parent_id, project_id, order, flagged, due_at, defer_until, revision, timestamps, and display provenance of the creator and latest changer |
| projects | user, id | local name, description, parent_id, sibling order, revision, timestamps |
| tags | user, id | local name, description, parent_id, revision, timestamps |
| action_tags | user, action_id, tag_id | many-to-many association and revision |
| catalog_identity_ledger | user, kind, identity | reserved catalog IDs and latest project/tag/action_tag mutation revision |
| perspectives | user, id | name, description, filter, definition_version, revision, created_at, updated_at |
| operations | user, operation_id | canonical request, result, delta, before/after revision, undo_of, timestamp, whether the person or a client connection made it, the committing OAuth client (provenance only) and the caller's optional summary |
| client_names | user, client_id | the connected client's latest unverified registration name, for display |

There is no tasks, task_tags, or dependencies table in the current schema. Action relationships are parent-child containment only. Independent prerequisite edges and sequential/parallel modes are unsupported. An explicit on-hold action remains an ordinary unfinished action.

## PostgreSQL schema and transaction contract

Use PostgreSQL 18 with schemas `state` and `identity`. All state tables have an opaque TEXT `user_id` and user-leading keys. The application owns user isolation: verified server identity binds the store capability; every business query supplies that user explicitly in its predicate, inserted row and conflict key. Request arguments cannot select a user. PostgreSQL RLS and connection-local user settings are not used. Composite foreign keys retain containment and association integrity within each user. Identity mapping uses closed issuer/subject queries. Runtime, migration and export roles retain separate table privileges; direct SQL with runtime credentials is trusted server access, not an end-user API.

### Scalar mapping and constraints

| Value | PostgreSQL representation / rule |
| --- | --- |
| user, entity/operation IDs, parent and classification IDs | TEXT COLLATE "C"; preserve exact strings, including UUID case; do not normalize through PostgreSQL uuid |
| revisions, association generations and sibling ranks | BIGINT with 0..9007199254740991 checks; decode strings to safe integers after bounds validation |
| flagged | BOOLEAN; explicit adapter conversion to/from the pure storage-plan scalar contract |
| lifecycle | TEXT with active/on-hold/completed/dropped CHECK |
| due/defer and entity timestamps | Canonical UTC ISO text matching domain output; nullable only where the API permits; no driver Date conversion |
| title, notes, action metadata, catalog name/description | TEXT containing canonical JSON.stringify(string); decode exactly with JSON.parse |
| canonical_payload, result, delta, perspective body | TEXT containing exact serialized JSON; validate with PostgreSQL json, not jsonb normalization |
| identity/session expiry and last activity | TIMESTAMPTZ; internal control data, not API text |

The free-text codec is deliberate: PostgreSQL text cannot contain NUL and jsonb cannot represent all JSON string values. JSON string encoding preserves accepted U+0000 and lone UTF-16 surrogates without changing the public API. Do not reject, replace or silently normalize existing user text. Decode before display, domain comparison, filtering and sorting. Catalog uniqueness uses the injective encoded name with C collation, preserving exact sibling-name equality. Do not use SQL lexical ordering of encoded names to replace domain ordering. Canonical request/receipt/delta JSON remains TEXT so exact replay identity and Undo comparisons survive import. SQL JSON checks use the json type and do not extract arbitrary free-text fields through PostgreSQL jsonb. Include NUL, quotes, backslashes, emoji, lone surrogates, Japanese and mixed-case IDs in round-trip tests.

### Keys and indexes

- actions/projects/tags/perspectives: PRIMARY KEY(user_id,id). Projects/tags have two unique indexes: (user_id,name) WHERE parent_id IS NULL and (user_id,parent_id,name) WHERE parent_id IS NOT NULL.
- action_tags: PRIMARY KEY(user_id,action_id,tag_id). Add (user_id,tag_id,action_id) for reverse membership.
- catalog_identity_ledger: PRIMARY KEY(user_id,kind,identity); kind is one of project, tag, action_tag and perspective, matching the domain codec. Retain identity rows for deleted records.
- operations: PRIMARY KEY(user_id,operation_id), UNIQUE(user_id,revision_after), CHECK revision_after=revision_before+1, and an index (user_id,undo_of) WHERE undo_of IS NOT NULL. Receipt contents are immutable after insertion; retention only deletes an oldest prefix. `client_id` records the verified OAuth client of the committing request, and `actor_kind` records `user` for a Gate browser session in the Weave app or `client` for a bearer-token connection. They are NULL for operations committed before migrations 0005 and 0006 and are never read for authorization.
- Add (user_id,parent_id) indexes for containment and (user_id,project_id) for actions. Use user-composite DEFERRABLE INITIALLY DEFERRED foreign keys for action parent/project, catalog parent and action_tag references. No cascading deletes; the domain's explicit changed-row plan owns detachment/removal. No foreign key from identity markers or undo_of to retained records, because deletion/pruning must not erase recovery markers or prevent history retention.
- Perspective definition_version CHECK is 1 or 2 and its body is a JSON object validated through json. Domain code validates variant/query shape and references; DB constraints do not invent hierarchy or perspective semantics.

### Read acquisition

`readSnapshot`, `readOperationState` and `readChangeWindow` each check out one client, BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY, SET LOCAL user, capture all necessary scalar rows, COMMIT, release, and decode. The first query pins the snapshot; all later queries use it. A single SQL statement with independent subqueries may capture the seven logical state sets and optional receipt to reduce network round trips. Do not join independent tables into a multiplicative Cartesian result. Receipt and snapshot rows are captured together; `ReadOperationState.snapshot()` remains a memoized synchronous decoder without IO so idempotency mismatch is checked before graph decoding/validation.

Use the same consistent acquisition for feed head, oldest retained revision and rows after a cursor (at most 101). Plain receipt and Undo-marker reads are parameterized user-scoped statements; the eventual write CAS rejects any intervening business operation. Reads never create coordination, business or identity rows.

### Commit algorithm

`UserActionStore.commit` receives canonical input, prepared before/after state, now and optional Undo target. Generate the pure changed-row/storage plan before acquiring a write connection; Gate introspection is repeated under the acquired lock before business effects; no external user interaction occurs under the lock.

1. Check out a client and BEGIN at READ COMMITTED; set transaction-local user and deadlines. Recheck the verified principal/subject mapping using its immutable auth context; a disabled subject rejects before business effects.
2. Acquire `pg_advisory_xact_lock($1::bigint)`, with the signed 64-bit key derived from the first 8 bytes of SHA-256 of the UTF-8 domain-separated string `action-tools/owner-commit/v1` + NUL + exact user. This versioned cryptographic namespace is fixed; use the same derivation in API, migrations and fixtures. Hash collisions only serialize unrelated users; SQL identity never uses the hash. Transaction-level locks release automatically on commit/rollback and cover concurrent first writes without a user-state row.
3. In a statement AFTER lock acquisition, reread the receipt by operation ID. A matching receipt returns its original result without reapplying; mismatched canonical TEXT returns idempotency_conflict. Receipt classification takes precedence over revision conflict. Do not combine waiting for the lock and the revision query into a statement whose snapshot could predate the previous commit.
4. Read MAX(revision_after), or zero. Compare with before.revision; mismatch rejects with conflict. The lock serializes every business writer, so revisions allocated as before+1 follow commit order; never use a global sequence as user commit order.
5. Insert the receipt and apply changed action/catalog/association rows plus identity markers. In the same transaction, prune the oldest prefix of operations beyond the retention policy: everything at or below max(new_revision-5000, min(new_revision-100, r-1)), where r is the oldest retained revision committed within 30 days of the commit time. Deferred foreign keys are checked at COMMIT. Unchanged rows are not rewritten. No full-state JSON or user-wide deletion is permitted.
6. COMMIT and release the connection. The application then obtains a fresh consistent snapshot with the original operation result; it does not return prepared state. Later concurrent corrections can appear in that snapshot.

Do not use repeatable-read for the lock/CAS write path: its first statement could pin a snapshot before a writer being waited on commits. Read-committed is sufficient because every same-user writer takes the same transaction lock; no user mutation can intervene before COMMIT. Schema migrations/imports require an environment write fence, not advisory locks alone. [Isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [locks](https://www.postgresql.org/docs/current/explicit-locking.html).

### Failure, replay, Undo and feed

Known errors before COMMIT roll back and release the client in finally. Connection loss during/after COMMIT, deadline expiry after dispatch, process termination and a failed post-commit snapshot are unknown outcomes. Never retry with fresh IDs or rebase caller input automatically. Lookup/identical replay resolves a retained receipt; `not_observed` alone is not proof that a still-running operation failed. Destroy an uncertain/broken client rather than returning it to the pool. No automatic retry of a business transaction is required; safe transport retries preserve the exact request.

A retained Undo target and marker read can race with another writer; the commit CAS detects any resulting revision advance. Check target after-state/revision and catalog markers through the same pure Undo rules. Keep the 100-operation retention and replay scope; do not promise indefinite deduplication. Cursor JSON remains version 1 with the existing fields. Its 43-character scope is base64url(SHA-256(UTF-8(`action-tools/change-cursor/scope/v2` + NUL + exact user + NUL + CURSOR_EPOCH))). CURSOR_EPOCH is a nonsecret random deployment UUID stored in environment configuration outside database backups; every serving revision uses the same value. Rotate it on cutover and after restoration to an earlier timeline, before opening traffic. This intentionally invalidates pre-cutover/restored-timeline cursors through invalid_cursor and requires a complete snapshot; ordinary releases preserve the epoch. No old-scope compatibility fallback is provided. Retain dirty drafts and exact pending requests; a data-loss restore requires explicit reconciliation before resuming unresolved writes. The epoch is a cache/retrieval boundary, not an authorization credential.

## Order and direct flags

`order` is a nonnegative safe integer rank (0 through 9,007,199,254,740,991). Siblings share a parent; roots share a project, with unassigned roots forming their own group. An omitted rank appends after the greatest rank in that scope, starting at zero. Moving an action to a different parent, or moving a root to another project, appends at the destination unless a parent edit explicitly supplies a rank. If the maximum rank is exhausted, supply explicit ranks to renumber before appending.

Ranks may have gaps or duplicates. Equal ranks are ordered by stable action ID. Read results group roots by project ID, order siblings by rank then ID, and emit each parent's descendants immediately after it. Filtering preserves that relative order. Changing a rank does not rewrite neighboring actions or impose completion, visibility, or availability constraints: a later sibling can complete first.

`flagged` is a strict boolean, false for new actions unless supplied explicitly. It is direct state only: neither action parents nor projects supply inherited flags. Flag changes do not change lifecycle status, Due, or Defer. Completion, withdrawal and reopen preserve it. Queries can filter either boolean value across all lifecycle states. The UI Flag scope contains flagged actions whose projected view is normal; deferred flags remain stored and can be retrieved by query.

## Lifecycle and projection

Lifecycle values are `active / on-hold / completed / dropped`. The view is calculated on read, in this priority order:

1. dropped: cancelled;
2. completed: completed;
3. future Defer on the action or an ancestor: deferred;
4. otherwise: normal.

`is_deferred` independently reports future own/ancestor Defer, even for completed or dropped actions. `defer_reasons` identifies the source action, title, UTC instant and whether it is an ancestor. Reading after expiry changes the projection without rewriting stored dates or reopening completed actions. Due is a deadline and never hides an action.

Inbox is all project-unassigned unfinished actions (active/on-hold), including deferred actions. Waiting is explicit on-hold, also including deferred actions. Neither depends on title, an organization flag, or prerequisite state. The response contains no waiting/prerequisites arrays on individual actions.

Setting a parent completed atomically completes all descendants while preserving their other attributes. Completing children never automatically completes a parent. A descendant may later reopen independently. Withdrawal stores dropped rather than deleting the action; associations and containment remain editable.

## Dates and hierarchy

Timestamp inputs require Z or an explicit UTC offset and are normalized to UTC ISO instants. Date-only Defer requires the request's client timezone and resolves that day's 09:00 there. Saved instants do not change when the client timezone changes. Nonexistent or ambiguous wall times require an explicit instant. Timezones are not persisted.

An action has at most one parent and one project, plus multiple tags. Cycles, missing parents and invalid associations are rejected in pure logic; there are no SQL foreign-key constraints for these references. Project and tag hierarchies are separate from action containment and do not inherit lifecycle, dates, membership or flags.

Catalog names are local, trimmed and case-sensitive; derived display paths join ancestor names with `/`. Identity always uses server-generated UUIDs. Get-or-create matches user, parent and local name. Root/nested natural-key indexes reject nonempty-name duplicates; all sibling names participate in uniqueness. Deleted project/tag IDs remain reserved and can only be restored by an applicable Undo. New action/project/tag IDs cannot be supplied by callers. Structure requests use unique local refs; the first ref edits the existing action and later refs create actions. Parent refs need not precede children in the request.

## Atomic writes, replay and Undo

Write entry acquires the receipt and current state consistently. Canonical input comparison precedes graph decoding/validation and ID allocation. Identical replay returns the stored result with current state. A new operation validates the snapshot, commits under the user revision guard, and reads fresh current state after commit rather than substituting prepared state.

User revision is the latest committed operation revision, zero when empty. Revision validation, changed action/catalog/association rows, identity markers, receipt and retention pruning share one PostgreSQL transaction. Failure rolls back the whole operation. No full-snapshot replacement or full-delete/full-save storage is permitted. Retain each user's operations for 30 days, never fewer than the latest 100 and never more than the latest 5000. Commit order, cursor progression and retention fences must agree under concurrency.

Undo compares the current action state and revision with its recorded after-state. Order and flag changes participate in the same comparison and restoration. Unrelated changes are preserved; later changes to the target reject Undo. Catalog identity markers detect delete/restore or detach/reattach ABA and reference changes. Restoring an association to a deleted tag omits that association while restoring other eligible changes. Undo of an addition marks the action dropped rather than physically deleting it. Undo of Undo is unsupported.

## Saved perspectives

A perspective is a user-scoped View storing extraction conditions in an explicit variant. It contains id, name, description, definition_version (1 or 2), the version-specific body in the physical `filter` serialized-JSON TEXT column, revision and timestamps; `user_id` is mandatory in SQL and supplied by trusted server context, omitted from user-scoped domain snapshots. Domain/API snapshots expose exactly `{definition_version:1, filter}` or `{definition_version:2, query}`. The legacy column name is a storage detail; callers never receive a query under `filter`. IDs are server-generated and remain reserved after removal. Names need not be unique.

Version 1 filters accept statuses (unique lifecycle array), is_deferred, flagged, project_id (UUID/null), tag_id and include_descendants. Conditions combine with AND; status values are alternatives within the array. Omission is unrestricted, {} matches all lifecycle states, and statuses:[] matches none. Explicit project_id:null means unassigned. Omitted `include_descendants` is false for v1. Version 2 stores the structured `query` AST documented in [perspective-query](perspective-query.md); classification leaves default `include_descendants` to true. Query normalization and reference guards include negative and set predicates.

Evaluation projects the confirmed user snapshot at read time. Version 1 preserves action-tree relative order. Version 2 preserves that order when `order_by` is omitted and applies an explicit sort globally across all matches; UI results are flat and do not insert nonmatching parents. Neither variant stores action copies or match membership. Direct flags do not propagate. Reads never advance revision or rewrite expired Defer.

The [pure query kernel](perspective-query.md) evaluates v2 definitions; the UI translates v1 filters through the same evaluator, while server v1 reads retain their existing filter path. Shared v1 parity tests keep their result semantics aligned without changing the legacy server path.


## Catalog descriptions

Projects, tags and perspectives store non-null `description` text, defaulting to empty. It is optional caller-controlled context, preserved exactly and limited to 65,536 UTF-16 code units by pure validation. It does not affect identity, inheritance, membership, lifecycle or perspective predicates. Description edits use ordinary catalog deltas, identity markers, revision, receipts and Undo.

[Migration 0011](../../drizzle/0011_catalog_descriptions.sql) adds these columns without resetting records, revisions, associations or operation history. Receipt bytes are retained, but Undo requires current-schema description fields and rejects incomplete deltas without filling them. This is separate from the retired action-model conversion/reset.

New Action titles and explicit title edits require nonempty trimmed text (maximum 200 UTF-16 code units). Every stored Action must satisfy the current required-title contract; invalid stored records fail validation without automatic correction or deletion. Notes are optional exact raw text and cannot replace the required title on creation. Perspective names and structure reference names remain nonempty; Project/Tag name writes require nonempty trimmed text. Initial `add.tag_ids` are unique user-scoped tag IDs; their association rows and identity revisions share the action creation CAS transaction, receipt and Undo delta. The Action title and initial Tag-association contract requires no schema migration; catalog indexes enforce the exact sibling-name contract.

Action `metadata` is optional exact text, limited to 65,536 UTF-16 code units, and defaults to empty. It stores caller-managed operational data separately from human-facing content and exact original input in `notes`. Omitted metadata on edit preserves it; an explicit empty string clears it. Reads, deltas, receipts, replay, Undo and transfer include the field. It is not shown in the UI Action Detail. [Migration 0009](../../db/postgres/migrations/0009_application_user_scope.sql) removes RLS and ensures metadata exists in saved Actions and retained action/collaboration deltas without extracting or rewriting Notes. It supersedes unapplied `0007_action_metadata_text.sql`; previously recorded checksums remain verified and unchanged. A schema-owning migration role needs neither superuser nor BYPASSRLS. The SQLite contract migration is [0018](../../drizzle/0018_action_metadata.sql). Logical export emits the current transfer version, 9; older versions are rejected, so export again after a migration before transferring data.

`action_move` changes only effective selected roots' parent containment and affected destination sibling ranks. Selected descendants of selected ancestors travel with their subtree rather than moving twice. Before/After uses the anchor parent; Into appends children; top-level detach appends separately within each root's unchanged Project group. Root Before/After requires matching direct Project membership. Hidden siblings retain relative order; source-only gaps remain valid. Actual changed rows share the ordinary revision/receipt/delta/Undo transaction.

The UI Projects/Tags outline combines catalog hierarchy with direct Action membership. Action containment changes indentation only within the same membership; it never inherits a Project or Tag. Repeated Tag occurrences share one Action UUID, draft, write and Undo identity. Catalog inspectors use separate typed name/description drafts and the existing catalog revision/receipt path.

`action_project` and `action_tag` accept an existing `id` or a nonempty unique `ids` list, exclusively. Every listed Action receives the direct classification change, including selected ancestors and descendants. One operation shares the same user revision, atomic associations/identity markers, receipt and Undo. Project changes preserve containment and child order; changed roots append to destination Project scope in caller order. Tag addition preserves other direct Tags.

## Project sibling order

Projects have a required nonnegative safe integer `order` independent of Action rank. Siblings compare order, local name and UUID. New Projects append to their parent scope. Direct `project_move` parent changes append; relative before/after/inside/root moves change the parent and normalize only the destination sequence when it changes. Source gaps remain valid. Intact Project descendants, direct Action membership, Action containment, lifecycle, dates, flags and Tags remain unchanged. Tag moves follow the same durable sibling-order contract.

Migration 0013 adds Project order with default zero and an integer range check, preserving existing records, revisions, identity markers and receipt bytes. Ties preserve alphabetical presentation for migrated Projects. Project delta records missing order are rejected; snapshots and Undo require the current complete schema. Destination peers changed by a move share catalog revision/identity markers, so later hidden sibling corrections reject destructive Undo.

## Required catalog names

`project_add` and `tag_add` accept `{name,parent_id?,description?}` without a caller ID. The server always creates a distinct UUID and returns `result.resolved.project` or `result.resolved.tag` as `{id,created:true}`. Names are trimmed strings up to 200 UTF-16 code units, requiring nonempty trimmed text for creation and name edits. All stored names must satisfy the same current nonempty contract. Nonempty names remain case-sensitive and unique under the same parent. `project_get_or_create` and `tag_get_or_create` still require nonempty names and preserve existing descriptions on a match.

Project and Tag creation append within their respective parents using durable order. Creation does not assign Actions. Exact replay returns the receipt’s original generated ID without allocating a duplicate; unknown outcomes retain the same operation ID and arguments. Creation uses the existing user-wide CAS, atomic catalog/identity/receipt batch and conflict-safe Undo. Forward migration `0015_required_catalog_names` restores four full sibling-name uniqueness indexes without rewriting applied migrations or stored rows. Invalid duplicate data causes migration failure; it is not repaired, renamed or deleted. Current-schema rows and receipts are required for reads, writes and Undo. Missing Project/Tag order, catalog description or collections are rejected instead of synthesized. Ordinary exact replay, CAS and conditional Undo remain unchanged for valid current-schema operations.

## Tag sibling order

Tags require a nonnegative safe-integer `order`, persisted independently of Action associations. New Tags append after the highest rank under the same parent. Equal ranks sort by local name, then UUID. `tag_move` accepts `{id,parent_id:null|uuid}` or `{id,placement:before|after|inside|root,anchor_id?}`; the forms are exclusive. Relative movement normalizes only destination sibling ranks when their sequence changes. Direct same-parent movement and unchanged relative sequences leave rows unchanged. Moves preserve subtrees and Action associations, reject cycles and sibling-name collisions, and share ordinary user revision, atomic receipt, replay and Undo guarantees across all touched peers. Stored Snapshot and receipt Tag rows require `order`; absent values are rejected without runtime conversion.

Forward migration `0016_tag_order.sql` adds the constrained column with SQL default `0`, retaining all existing rows and receipt bytes. This migration does not rewrite historical receipts. Old receipts lacking required Tag order are invalid under the current schema. Existing migration files remain unchanged.

## Collaboration records

`state.collaborations` stores one head per `(user_id,id)`, a nullable user-composite action reference, revision and JSON text body. `state.collaboration_history` stores immutable `(user_id,operation_id)` events with collaboration ID, revision, command, authenticated actor, complete resulting record, canonical input, receipt result and action delta. Both use explicit application-bound user predicates. Runtime privileges permit head insertion/update and history insertion/read, not history rewrite.

Each mutation shares the existing user-wide CAS transaction with action changes, identity markers, receipts and pruning. Adoption can create an action and link its proposal atomically. Collaboration-only events advance revision with an empty ordinary action delta. Reads include heads from the same repeatable-read snapshot. History pages contain at most 50 events bounded by the captured revision.

Proposal `version` changes only on scope revision. `decision` is business intent; `progress` and `outcome` are reported facts. Run identity and authenticated connection bind ordinary progress reports. Explicit `reconcile` permits an authorized writer to record independently observed evidence for unresolved/stopped work; the event records that writer while retaining original run provenance. This is not an external cancellation or authorization guarantee.

An Action retains up to three proposal heads. At most one is approved; running/waiting work and unknown outcomes block another approval. Cancellation retains the proposal as pending. Legacy withdrawn/rejected heads remain readable and count toward the cap. Accepted scope does not start work; a report does not complete an action. Collaboration events cannot be reversed by generic Undo. Durable collaboration history supplies exact replay receipts after ordinary operation retention; no automatic history pruning is configured. The transfer manifest includes heads and history.

## Change review data

Migration `0010_change_review.sql` adds display and provenance data for reviewing changes. None of it grants, selects or restricts access, and none of it enters persisted Action DTOs, deltas, Undo comparisons or the change feed's persisted records.

- `operations.summary` is nullable text-cell JSON holding the writer's optional description, stored exactly. It is copied from the validated request, which already contains it in the canonical payload, so replay identity covers it.
- `actions.created_by_kind/created_by_client_id` and `updated_by_kind/updated_by_client_id` record the verified committer. Every changed Action row in a commit, including cascades, moved peers and Undo restorations, takes the committer as its latest changer; a newly inserted row also takes it as its creator, and an existing row keeps its creator. Rows saved before the migration keep NULL, meaning unknown. Unchanged rows are not rewritten.
- `client_names(user_id, client_id)` holds the name Gate relayed for a client connection, upserted in the commit transaction only when a client writes with a valid name. Browser sessions and reads never write it. A later name replaces the display name for that connection only.

The PostgreSQL store reads provenance and names in the same repeatable-read snapshot as the Actions. `readRecentChanges(before, limit)` reads the head, the oldest retained revision and up to `limit` operations at or below `min(before-1, head)` newest first, with each operation's receipt result and the operation that undid it, in one read-only transaction. The application validates contiguity and evaluates advisory Undo availability against a fresh snapshot with the pure Undo rules. The memory fake records summaries and implements recent reads; the supplemental D1 adapter returns null summaries and names and has no recent-history read. Logical transfer carries the new columns and `state.client_names`. The runtime role needs SELECT, INSERT and UPDATE on `state.client_names`.

## Collaboration delegation

Each collaboration record's JSON body carries `delegation` with separate `mode` (`any_ai` or `specified_ai`) and `client_id` (null for any AI). It is shared state only: no transition reads it to accept or reject a write, and `assign` changes it in any state. Migration `0011_collaboration_delegation.sql` states any AI for existing heads and history by splicing the member in front of each serialized body, which begins with a key, so no stored text is reinterpreted. Records saved before then were open to any AI. Transfer version 9 requires the member; version 8 is rejected.

`list_assigned_collaborations` derives reasons from the current snapshot and the verified store actor with the pure `assignmentReason`; nothing about it is stored.

## MCP delivery metadata

`state.mcp_subscriptions` has `(user_id,connection_id,resource)` as its primary key and an `expires_at` timestamp; `resource` is `action-state://current` or `action-state://assigned`, and migration 0011 kept existing rows on the shared state. It stores only subscription preferences for those resources, with explicit application-bound user predicates. It grants no access: every stream is authenticated and revalidated through Gate. Runtime receives SELECT/INSERT/UPDATE/DELETE; export receives explicit SELECT privileges. Subscription updates do not advance business revision or create action receipts. Expired entries are inactive. Logical transfer intentionally excludes this transient delivery metadata; clients resubscribe after transfer.
