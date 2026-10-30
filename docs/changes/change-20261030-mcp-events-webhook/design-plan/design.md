# MCP Events webhook delivery

Deliver identifier-only collaboration change hints to verified subscribed client connections without an idle delivery process, preserving shared-state write guarantees.

A domain-independent webhook module owns callback verification, protected secrets and delivery state. The shared PostgreSQL commit owns event selection, immutable pending rows and one write-batch record. Exactly one named Cloud Tasks wakeup is attempted before COMMIT for a write producing deliveries, regardless of fanout. After commit, bounded idempotent fanout pages establish child delivery tasks and durable continuations before acknowledgment. Only precommit wakeup enqueue outage/uncertainty uses authenticated-request recovery. Gate supplies uncached connection validity.

<a id="assessment"></a>

## Assessment and applicability

Independent assessment: **approved**. The revised architecture is sufficient for the delegated technical-design outcome. Independent reassessment of the whole candidate found no remaining material design defect: the current repository consultation authorizes one precommit wakeup per nonempty write, immutable committed batch membership, and bounded idempotent fanout with durable continuation; these remove the prior unbounded precommit network fanout premise. Contiguous cursor advancement, exact-name retries, fencing and retention preserve recovery across partial effects, while the current task remains retryable until a successor is confirmed or membership is complete. Responsibility separation remains justified: domain eligibility and atomic receipt/outbox composition belong to the shared commit, domain-independent subscription/signing/HTTPS mechanics to the webhook module, and task authentication and online Gate authority to their adapters. The selected wire behavior, isolation, revocation/expiry, rollback/replay, unknown results, bounded callback retries and unchanged resource transports have discriminating verification obligations. The supplied pursuit has no unprocessed returns; its earlier recovery question is addressed by the current owner corrections rather than historical acceptance. Approval covers the architecture and planned verification, not implemented or deployed behavior. Actual Gate contract agreement/release, Cloud Tasks identity/dedup/retry behavior, Neon and subscribed Work-chat acceptance remain explicit release prerequisites. No repository writes, runtime tests, deployments or external observations were performed.

The ADR statuses below retain their supplied values; architecture approval does not itself change their lifecycle status. All runtime witnesses remain planned and unexecuted.

<a id="scope"></a>

## Scope

### Included

- Authenticated 2026-07-28 events methods and collaboration_changed hints
- Subscription and outbox schema, guarded HTTPS, signatures, Cloud Tasks and Gate validity port
- Cross-repository Gate API handoff, migrations and actual-host acceptance obligations
- Narrow AGENTS.md and ARCHITECTURE.md responsibility correction and change-package projections

### Excluded

- Polling, push, listChanged, gap/terminated, replay history
- AI scheduling, starting or approving work, person notifications
- Changes to action API schemaVersion 2, resource subscriptions or Cloud Run billing
- Gate repository writes or deployment in this invocation; shared package publication

<a id="requirements"></a>

## Effective requirements

<a id="req-discovery"></a>

### req-discovery

When an authenticated 2026-07-28 client discovers or lists events, the server shall expose the webhook-only event catalog and schemas with cursor pagination.

Type: event_driven; priority: must. Source and rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md S1; C6

<a id="req-subscription"></a>

### req-subscription

When a verified client subscribes, the server shall authorize identity and arguments, verify a safe HTTPS callback and persist one idempotent expiring subscription; unsubscribe shall be authorized and idempotent.

Type: event_driven; priority: must. Source and rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md S2; S7; C1

<a id="req-meaning"></a>

### req-meaning

When a committed shared-path change affects collaboration work relevant to a subscribed connection, the server shall persist one identifier/revision-only logical event per subscription, collaboration and committed revision.

Type: event_driven; priority: must. Source and rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md S3; C2-C5

<a id="req-recovery"></a>

### req-recovery

When pending deliveries are produced, the transaction shall attempt exactly one durable write-batch wakeup before COMMIT. A confirmed wakeup shall survive process exit and fan out all committed pending rows through bounded invocations and durable continuations, without any later client request. Only precommit wakeup enqueue outage or uncertain enqueue permits conditional recovery on the next authenticated request, including refresh.

Type: complex; priority: must. Source and rationale: docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md#owner-decision-one-precommit-wakeup-per-write supersedes the earlier per-delivery precommit task decision and resolves normal-operation fanout; S5 and the queue-outage exception remain.

<a id="req-idle"></a>

### req-idle

While no delivery or recovery request is outstanding, the service shall run no delivery process, polling, open stream or scheduled sweep, and shall preserve request-based Cloud Run billing.

Type: state_driven; priority: must. Source and rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md S4 and owner correction

<a id="req-security"></a>

### req-security

The service shall keep subscription and delivery state user/connection scoped; reject unsafe destinations and redirects; encrypt callback secrets; emit no content, credentials or callback URL in logs.

Type: ubiquitous; priority: must. Source and rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md C1; C2; C4; repository constraints

<a id="req-delivery"></a>

### req-delivery

When sending, the service shall check current subscription lifetime and Gate connection validity, sign exact serialized bytes with fresh attempt timestamp, retry transient failures within bounds and stop on revocation, expiry, unsubscribe, 410 or 413.

Type: complex; priority: must. Source and rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md S5-S7 and supplied wire snapshot

<a id="req-integrity"></a>

### req-integrity

The change shall preserve schemaVersion 2, atomic CAS/receipts/history, identical replay, unknown-outcome recovery and existing resource subscriptions, without starting or approving any work.

Type: ubiquitous; priority: must. Source and rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md C3; C5; C6; repository contracts

<a id="components"></a>

## Responsibility and repository grounding

<a id="component-protocol"></a>

### Remote MCP composition

Authorize and expose event wire contracts while preserving resource transports.

- Status: existing. Owner: Remote MCP composition.
- Paths: lib/mcp/dispatcher.ts, lib/mcp/protocol.ts, lib/server/node/server.ts
- Integration: dispatchMcp modern(), negotiate(), createAuthentication
- Test seams: tests/postgres/ HTTP/MCP fixture; scripts/testing/verify-node-built.mjs
- Rationale: Authorize and expose event wire contracts while preserving resource transports.
- Applicable existing accepted ADRs: none asserted

<a id="component-webhook"></a>

### Generic webhook module

Own protocol-neutral subscription lifecycle, pure verification/signing/retry decisions and effect ports; import no action or collaboration modules.

- Status: planned. Owner: Generic webhook module.
- Paths: lib/webhook/, lib/adapters/postgres/webhook-store.ts, lib/server/node/webhook-https.ts
- Integration: Injected subscription persistence, clock, randomness, encryption, DNS, HTTPS and task ports
- Test seams: Planned pure module and real HTTPS/DNS adapter suites
- Rationale: Own protocol-neutral subscription lifecycle, pure verification/signing/retry decisions and effect ports; import no action or collaboration modules.
- Applicable existing accepted ADRs: none asserted

<a id="component-commit"></a>

### Shared state commit

Own domain eligibility and atomic outbox insertion inside the existing receipt/CAS transaction.

- Status: existing. Owner: Shared state commit.
- Paths: lib/domain/collaboration.ts, lib/application/ports.ts, lib/adapters/postgres/action-store.ts, db/schema.ts, db/postgres/migrations/
- Integration: assignmentReason, createPostgresActionStore.commit, userTransaction
- Test seams: Real PostgreSQL transactional adapter contracts
- Rationale: Own domain eligibility and atomic outbox insertion inside the existing receipt/CAS transaction.
- Applicable existing accepted ADRs: none asserted

<a id="component-worker"></a>

### Request-driven delivery

Authenticate task requests, consume committed pending deliveries, recheck subscription and Gate and send with bounded retries.

- Status: planned. Owner: Request-driven delivery.
- Paths: lib/server/node/webhook-delivery.ts, lib/server/node/server.ts, lib/server/node/config.ts, infra/
- Integration: Authenticated internal endpoint, Cloud Tasks OIDC, request recovery hook
- Test seams: Planned Cloud Tasks fixture and deployed Cloud Tasks acceptance
- Rationale: Authenticate task requests, consume committed pending deliveries, recheck subscription and Gate and send with bounded retries.
- Applicable existing accepted ADRs: none asserted

<a id="component-gate"></a>

### Gate validity integration

Define the online authority port and Gate-side implementation obligation; no token is retained for background use.

- Status: planned. Owner: Gate validity integration.
- Paths: lib/server/node/gate-connection.ts, lib/server/node/authentication.ts
- Integration: Verified principal issuer, subject, connectionId and clientId; resource authentication
- Test seams: Synthetic Gate HTTPS fixture; actual Gate handoff acceptance
- Rationale: Define the online authority port and Gate-side implementation obligation; no token is retained for background use.
- Applicable existing accepted ADRs: none asserted

<a id="contracts"></a>

## Implementation contracts

<a id="contract-events-wire"></a>

### Modern-only event catalog, verified idempotent subscribe/refresh and unsubscribe.

Owner: component-protocol. Dimension: integration_contract. Requirements: [req-discovery](#req-discovery), [req-subscription](#req-subscription), [req-security](#req-security), [req-integrity](#req-integrity). ADRs: [adr-mcp-events-module](#adr-mcp-events-module), [adr-mcp-events-wire](#adr-mcp-events-wire).

#### Decision rules

<a id="decision-catalog"></a>

##### decision-catalog

When Authenticated discover/list on exactly 2026-07-28:

Expose collaboration_changed with description, delivery:[webhook], inputSchema {type:object,properties:{},additionalProperties:false}; payloadSchema requires collaboration_id, action_id (string or null), revision (nonnegative safe integer), additionalProperties:false. events/list accepts optional opaque catalog-version cursor and returns nextCursor only if more entries; immutable one-entry catalog needs no listChanged. Preserve existing capabilities and transport framing.

- Rationale: docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md wire snapshot and owner decisions 1,5; no aliases or draft-only modes.
- Evidence mode: total; state: determinate
- Inputs: [input-request-principal](#input-request-principal)
- Effects: [observable-events-catalog](#observable-events-catalog)

<a id="decision-subscribe"></a>

##### decision-subscribe

When Client bearer principal and valid name/arguments/delivery:

Require name=collaboration_changed, arguments={}, delivery={mode:webhook,url,secret}, optional ttlMs and cursor:null (no replay). Derive versioned SHA-256 ID over a length-delimited canonical tuple of issuer, subject, clientId, connectionId, event name, normalized URL and canonical arguments; secret and lifetime are excluded. URL normalization is WHATWG HTTPS serialization, rejects userinfo and fragments and preserves path/query. Require canonical base64 whsec_ secret decoding to 24-64 bytes. Finite lifetime default 24h, minimum 5m, maximum 7d; null requests receive finite default rather than infinite grant; positive ttlMs clamped to bounds. Verify before initial activation or secret change; refresh same identity extends lifetime, never duplicates it. No replay cursor support: return null,false. Do not claim a historical complete feed.

- Rationale: docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md permits finite TTL bounds and no replay; empty arguments avoid unjustified filters.
- Evidence mode: total; state: determinate
- Inputs: [input-request-principal](#input-request-principal), [input-subscription-state](#input-subscription-state), [input-callback-proof](#input-callback-proof)
- Effects: [observable-subscription-lifecycle](#observable-subscription-lifecycle)

<a id="decision-unsubscribe"></a>

##### decision-unsubscribe

When Valid tuple name, arguments, delivery:{mode:webhook,url} in same authenticated connection:

Compute the same identity; atomically stop subscription and invalidate generation. Missing/already stopped succeeds {}. Pending deliveries become stopped on their next attempt; no response reveals another account.

- Rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md S7 and snapshot unsubscribe shape.
- Evidence mode: total; state: determinate
- Inputs: [input-request-principal](#input-request-principal), [input-subscription-state](#input-subscription-state)
- Effects: [observable-subscription-lifecycle](#observable-subscription-lifecycle)

#### Operational inputs

<a id="input-request-principal"></a>

##### input-request-principal

- Kind: authority
- Owner: component-protocol; producer: component-protocol
- Source: lib/server/node/authentication.ts and principal.ts
- Acquire: each MCP request; retain until: authorization and subscription mutation
- Preservation: capability_bound; mutable before use: false
- Stability: Only issued and verified principal accepted; bearer required for event subscription.
- Invalidation: Reject invalid/revoked identity; never select user from params.
- Unavailable: 401/503; no lifecycle mutation
- Witnesses: [witness-wire-lifecycle](#witness-wire-lifecycle), [witness-wire-isolation](#witness-wire-isolation)

<a id="input-subscription-state"></a>

##### input-subscription-state

- Kind: versioned_state
- Owner: component-webhook; producer: component-webhook
- Source: New persistent subscription row keyed by deterministic identity
- Acquire: after authorization; retain until: activation/refresh/unsubscribe commit
- Preservation: current_lookup; mutable before use: true
- Stability: Compare-and-swap generation under the subscription lock; never hold DB lock across callback verification.
- Invalidation: Discard stale verification result; unsubscribe increments generation.
- Unavailable: Return retryable server failure; never activate from memory
- Witnesses: [witness-wire-lifecycle](#witness-wire-lifecycle), [witness-wire-isolation](#witness-wire-isolation)

<a id="input-callback-proof"></a>

##### input-callback-proof

- Kind: information; data scope: single_value
- Owner: component-webhook; producer: Callback HTTPS endpoint
- Source: Supplied wire snapshot in docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md
- Acquire: signed challenge POST; retain until: activation CAS
- Preservation: snapshot; mutable before use: false
- Stability: Random single-use 32-byte challenge, 5-second timeout, 4096-byte response bound; constant-time echo comparison. Successful proof cached for 5 minutes keyed by principal, URL and secret digest.
- Invalidation: URL, secret, principal or lifecycle-generation change invalidates proof.
- Unavailable: -32015 CallbackEndpointError; data.reason timeout, challenge_failed or endpoint_rejected; no active subscription
- Witnesses: [witness-wire-lifecycle](#witness-wire-lifecycle)

#### Observable effects

<a id="observable-events-catalog"></a>

##### observable-events-catalog

Only 2026-07-28 advertises events:{}; events/list returns the immutable catalog and modern complete envelope.

Scope: single. Inputs: [input-request-principal](#input-request-principal). Only the declared capability and versioned state establish this effect; unknown authority never counts as valid.

<a id="observable-subscription-lifecycle"></a>

##### observable-subscription-lifecycle

Validated subscription returns stable id, finite refreshBefore, cursor:null and truncated:false; repeated unsubscribe returns {}.

Scope: single. Inputs: [input-request-principal](#input-request-principal), [input-subscription-state](#input-subscription-state), [input-callback-proof](#input-callback-proof). Only the declared capability and versioned state establish this effect; unknown authority never counts as valid.

#### Invariants

- Subscription methods do not change user revision, action receipts or business state.
- MCP params._meta is transport metadata, excluded from canonical event arguments. Existing modern method/name header checks extend to event methods naming an event.
- No events capability on 2025 revisions; no change to existing resources/subscribe, GET SSE or subscriptions/listen.
- Refresh cannot revive a revoked connection, and verification finishing after unsubscribe cannot reactivate a stopped generation.

#### Failure semantics

<a id="failure-callback"></a>

##### failure-callback

Return -32015 with categorized reason, never -32027 alias; subscription remains inactive or prior verified generation unchanged.

Class: Verification or safe-HTTPS rejection. Source: unsupported_input. Requirement effect: preserves. Recovery: fail_fast.

<a id="failure-sub-race"></a>

##### failure-sub-race

Activation CAS fails on stale generation; caller may repeat authenticated subscribe. No silent lost unsubscribe.

Class: Concurrent refresh or unsubscribe. Source: transient. Requirement effect: preserves. Recovery: retry.

#### Contract evolution

##### Baseline verification refs

- verify-wire-isolation

##### Compatibility

backward_compatible

##### Consumer refs

###### External identity

Authenticated 2026-07-28 webhook caller

###### Kind

external

###### External identity

Existing 2025 resource subscription callers

###### Kind

external

##### Id

profile-events-evolution

##### Kind

contract_evolution

##### Migration strategy

Add event-only methods and tables; keep action schemaVersion2 and existing resource contracts by explicit owner decision5/C6. No aliases or earlier event-wire readers.

##### Rollback

Stop subscription generations and drain pending tasks, retain additive data and migrations before removing advertisement/worker.

##### Rollout

Add schema and queue/authority prerequisites before advertising events; actual Gate check required.

##### Surface

Remote MCP events methods, capabilities and additive subscription tables

##### Target verification refs

- verify-wire-lifecycle

##### Witness refs

- witness-wire-isolation
- witness-wire-lifecycle

#### Verification obligations

<a id="verify-wire-lifecycle"></a>

##### verify-wire-lifecycle

Extend real PostgreSQL HTTP/MCP fixture and actual HTTPS callback adapter fixture; existing scripts/testing/verify-node-built.mjs is available but event webhook assertions must be added.

Tier: T2. Requirements: [req-discovery](#req-discovery), [req-subscription](#req-subscription), [req-security](#req-security), [req-integrity](#req-integrity). Status: **not executed**.

<a id="verify-wire-isolation"></a>

##### verify-wire-isolation

Existing real PostgreSQL user-scope and built HTTP/MCP runners plus new cross-connection event cases.

Tier: T2. Requirements: [req-discovery](#req-discovery), [req-subscription](#req-subscription), [req-security](#req-security), [req-integrity](#req-integrity). Status: **not executed**.

#### Discriminating witnesses

<a id="witness-wire-lifecycle"></a>

##### witness-wire-lifecycle

Given Real Node HTTP/MCP server, PostgreSQL and controlled HTTPS callback with a synthetic whsec_ secret.

When Discover, list, subscribe twice with reordered argument keys, vary secret/TTL, wrong echo, timeout; unsubscribe twice and race unsubscribe with verification.

Expected:

- Modern catalog/schema/envelopes correct; one active row and stable ID; bad proof does not activate; exact challenge header/body verified; finite TTL and null replay cursor; stale proof cannot win unsubscribe.

Forbidden:

- Activation before proof, duplicate rows, -32027 alias, replay claim, changed action revision.

Effects: [observable-events-catalog](#observable-events-catalog), [observable-subscription-lifecycle](#observable-subscription-lifecycle). Verification: [verify-wire-lifecycle](#verify-wire-lifecycle).

<a id="witness-wire-isolation"></a>

##### witness-wire-isolation

Given Two users, same client ID, two connections, and legacy resource subscribers.

When Attempt cross-connection unsubscribe and forged public identity headers; call modern methods through 2025 negotiation; refresh with Gate outage.

Expected:

- No foreign row changes; legacy resource streams and modern listen keep baseline behavior; no events advertised to legacy; outage is unknown rather than valid.

Forbidden:

- User chosen from arguments, revoked refresh, resource subscription regression.

Effects: [observable-subscription-lifecycle](#observable-subscription-lifecycle), [observable-events-catalog](#observable-events-catalog). Verification: [verify-wire-isolation](#verify-wire-isolation).

<a id="contract-atomic-wakeup"></a>

### Domain event selection, atomic write-batch outbox and one precommit wakeup with durable bounded fanout.

Owner: component-commit. Dimension: failure_recovery. Requirements: [req-meaning](#req-meaning), [req-recovery](#req-recovery), [req-idle](#req-idle), [req-integrity](#req-integrity). ADRs: [adr-mcp-events-wakeup](#adr-mcp-events-wakeup), [adr-mcp-events-module](#adr-mcp-events-module).

#### Decision rules

<a id="decision-event-eligibility"></a>

##### decision-event-eligibility

When New business commit passes receipt/CAS guards:

Compare affected collaboration rows and linked Action state from before/after, including ordinary Action writes and Undo. For each active user subscription compute assignmentReason with its verified client/connection actor. Emit when relevant before OR after and the collaboration or linked Action changed, so withdrawal, reassignment and stop changes also wake the former relevant connection. Match the current assigned-read semantics rather than inventing new permission. No event for unrelated writes or unchanged replay. Store immutable bytes {eventId,name:collaboration_changed,timestamp:commit application instant,data:{collaboration_id,action_id,revision},cursor:null}.

- Rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md S3, C2-C5; assignmentReason source. Action edits can change collaboration eligibility without changing its own revision.
- Evidence mode: total; state: determinate
- Inputs: [input-commit-state](#input-commit-state)
- Effects: [observable-committed-hint](#observable-committed-hint)

<a id="decision-precommit-task"></a>

##### decision-precommit-task

When Pending deliveries inserted in current user transaction:

Pending delivery ID remains derived from user, subscription ID/generation, collaboration ID and committed revision, with a uniqueness constraint. In the same transaction persist one webhook_write_batch identified by stable user/operationId/revision with immutable membership of all pending rows and a durable fanout cursor. If membership is empty, make no queue call. Otherwise attempt exactly one createTask before COMMIT, name=hash(write identity,wakeup generation,start-position). Total create deadline is 3s, cancellation is awaited, and no detached promises run after the request. Mark batch wakeup confirmed only on success or matching ALREADY_EXISTS; keep batch not_enqueued on timeout/unavailability/unknown response and still commit the business write, as authorized. All delivery rows initially await fanout, not individual precommit enqueue. The precommit network call count is 1 for every nonempty batch, independent of subscriptions and affected collaborations. No subscription quota or valid-write rejection is added. The 3s limit is a per-single-call queue timeout, not a fanout capacity assumption.

- Rationale: docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md#owner-decision-one-precommit-wakeup-per-write expressly authorizes a batch wakeup. It removes fanout-proportional precommit network work; current 5s idle DB timeout and 20s request deadline still govern existing SQL/business work, rather than being extended or used to invent quotas.
- Evidence mode: total; state: determinate
- Inputs: [input-commit-state](#input-commit-state), [input-task-wakeup](#input-task-wakeup)
- Effects: [observable-durable-wakeup](#observable-durable-wakeup)

<a id="decision-early-worker"></a>

##### decision-early-worker

When Write-batch wakeup arrives before transaction resolves, or batch row is absent:

The wakeup endpoint acquires the same per-user advisory lock used by the originating write before classifying batch absence, then performs a READ COMMITTED lookup by user/write identity. Lock timeout is retryable and is NOT absence. After lock acquisition the originating transaction has ended: absent batch means rollback or obsolete generation. Retry confirmed absence only up to 120s from trusted task creation and then acknowledge without fanout or sending. A committed batch always bypasses absence termination. Release the business lock before Cloud Tasks, Gate or callback I/O. Delivery tasks are produced only from committed batch membership, never from caller-provided child IDs or uncommitted rows.

- Rationale: The existing userLockKey and transaction ordering prevent a bounded early probe from deleting the only wakeup while a slow commit is still possible.
- Evidence mode: total; state: determinate
- Inputs: [input-commit-state](#input-commit-state), [input-task-wakeup](#input-task-wakeup)
- Effects: [observable-durable-wakeup](#observable-durable-wakeup)

<a id="decision-recovery-hook"></a>

##### decision-recovery-hook

When A subsequent authenticated request is admitted:

After verifying current user and before completing the response, retry at most 20 not_enqueued write-batch wakeups for that user within a total 3s budget; this hook is only for the authorized precommit wakeup outage/uncertainty path. Claim batches briefly; retry the exact task identity first, then compare generation on update. events/subscribe refresh uses this hook. A failed recovery never fails an unrelated request, and remaining batches wait for later authenticated requests under the accepted degraded path. Child fanout is never moved to this hook because its page was full or its time budget elapsed: an existing wakeup/continuation remains responsible. No unauthenticated global scan or response-completion background work.

- Rationale: docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md only accepted degraded conditional path. No scheduled sweep.
- Evidence mode: total; state: determinate
- Inputs: [input-commit-state](#input-commit-state), [input-task-wakeup](#input-task-wakeup)
- Effects: [observable-conditional-recovery](#observable-conditional-recovery)

<a id="decision-bounded-fanout"></a>

##### decision-bounded-fanout

When Authenticated task identifies a committed write batch with remaining delivery rows:

POST /internal/webhook-fanout validates task authority and batch identity/generation, acquires a short durable per-batch lease/fencing token, and reads at most 21 membership rows ordered by immutable delivery_id after its durable cursor. Process at most 20 rows or 8s of enqueue work per invocation, reserving 2s for continuation creation. Each child task is named from immutable delivery identity and generation; child body includes delivery ID and trusted internal routing only. For a terminal child mark it handled without enqueue; otherwise confirm create/ALREADY_EXISTS before atomically marking child enqueued and advancing the contiguous cursor. Never skip an unconfirmed row; a timeout leaves it and cursor retryable. DB locks/transactions are short and never span these external calls. When rows remain, establish exactly named continuation keyed by batch identity, wakeup generation and current cursor before returning 2xx. If successor creation or progress persistence fails or is uncertain, return retryable 503 so the current durable task remains the wakeup. Only after confirmation may its successor marker be persisted and current task acknowledged; a crash at any earlier point causes current task retry. If no rows remain, atomically mark fanout complete and acknowledge. Any duplicate or stale-position task resumes current durable cursor, with lease CAS preventing conflicting progress; already complete batches acknowledge.

- Rationale: docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md#owner-decision-one-precommit-wakeup-per-write requires bounded fanout and continuation before return. No fixed fanout quota or healthy-queue next-request recovery is needed; task names and contiguous progress recover partial external effects.
- Evidence mode: total; state: determinate
- Inputs: [input-commit-state](#input-commit-state), [input-task-wakeup](#input-task-wakeup)
- Effects: [observable-durable-wakeup](#observable-durable-wakeup)

#### Operational inputs

<a id="input-commit-state"></a>

##### input-commit-state

- Kind: versioned_state
- Owner: component-commit; producer: component-commit
- Source: lib/adapters/postgres/action-store.ts commit and lib/domain/collaboration.ts assignmentReason
- Acquire: after user advisory lock and receipt/CAS validation; retain until: COMMIT or rollback
- Preservation: version_bound; mutable before use: true
- Stability: Use command before/after and current locked subscription rows in one transaction; no postcommit reconstruction.
- Invalidation: Identical replay exits before event selection; conflict/rollback creates no committed event.
- Unavailable: Preserve original write failure and exact unknown operation arguments
- Witnesses: [witness-atomic-selection](#witness-atomic-selection), [witness-wakeup-crash](#witness-wakeup-crash), [witness-batch-fanout](#witness-batch-fanout)

<a id="input-task-wakeup"></a>

##### input-task-wakeup

- Kind: information; data scope: single_value
- Owner: component-worker; producer: Cloud Tasks createTask
- Source: Owner correction in docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md
- Acquire: pending rows exist but before COMMIT; retain until: persistent pending delivery terminal outcome
- Preservation: immutable_value; mutable before use: false
- Stability: Precommit task name derives from stable user/write operation/revision plus wakeup generation. Continuation adds durable cursor position; child task name derives from pending delivery identity/generation. Immutable trusted bodies carry batch or delivery identity, routing, generation and creation time, never callback secret or personal text. Batch membership is fixed by the transaction; subsequent writes own different batches.
- Invalidation: ALREADY_EXISTS confirms the same generated task identity. Uncertain root create leaves batch not_enqueued. Uncertain child/successor create retains current task by returning503 and retries exact names; it never advances past an unconfirmed child. All progress mutations use lease fencing and user/batch predicates.
- Unavailable: Only root precommit create outage permits committing not_enqueued and next-request recovery. Child/continuation outage returns503 to existing task; finite delivery retry/age bounds still apply, never healthy-queue silent orphaning.
- Witnesses: [witness-wakeup-crash](#witness-wakeup-crash), [witness-enqueue-outage](#witness-enqueue-outage), [witness-batch-fanout](#witness-batch-fanout)

#### Observable effects

<a id="observable-committed-hint"></a>

##### observable-committed-hint

One logical collaboration_changed event per subscription/collaboration/revision is committed atomically with the business result.

Scope: single. Inputs: [input-commit-state](#input-commit-state). Only the declared capability and versioned state establish this effect; unknown authority never counts as valid.

<a id="observable-durable-wakeup"></a>

##### observable-durable-wakeup

One confirmed write-batch task survives commit-process exit and establishes delivery tasks or a confirmed continuation for every remaining page; a rolled-back batch never fans out. Each bounded healthy-queue invocation advances a finite contiguous membership set without waiting for a client request.

Scope: single. Inputs: [input-commit-state](#input-commit-state), [input-task-wakeup](#input-task-wakeup). Only the declared capability and versioned state establish this effect; unknown authority never counts as valid.

<a id="observable-conditional-recovery"></a>

##### observable-conditional-recovery

Precommit wakeup outage preserves the business write and not_enqueued batch; next authenticated request retries bounded batch wakeups only. Healthy-queue fanout always continues through durable tasks, with no scheduled or idle process.

Scope: single. Inputs: [input-commit-state](#input-commit-state), [input-task-wakeup](#input-task-wakeup). Only the declared capability and versioned state establish this effect; unknown authority never counts as valid.

#### Invariants

- One external task per nonempty write can outlive rollback; it is harmless because fanout requires a committed batch. Subsequent writes never add members behind an older batch cursor.
- Receipt, delta, changed rows, immutable pending rows, batch membership and root enqueue marker share one PostgreSQL transaction. Fanout progress thereafter uses short CAS transactions; no owner_state or full-delete/save.
- Identical business replay must not create another logical event or fresh operation ID.
- Subscription create/refresh/unsubscribe and event selection serialize on the same user advisory lock only during durable mutations; callback verification runs outside that lock.
- No permanently active process, timer, LISTEN/NOTIFY or delivery scheduler.
- For any nonterminal committed batch with a confirmed root wakeup, pending work is covered by the unacknowledged current task or a confirmed successor. No 2xx may remove the last durable wakeup while unhandled members remain. A process exit after a successor create but before recording it is handled by exact named-task retry.

#### Failure semantics

<a id="failure-queue-outage"></a>

##### failure-queue-outage

Precommit write-batch wakeup create outage or uncertain response: business write still commits; batch not_enqueued waits for the next authenticated request. This exception never covers healthy-queue fanout limits.

Class: Cloud Tasks timeout/unavailability or unknown create response. Source: environmental. Requirement effect: degrades. Recovery: retry. Approval: docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md#owner-decision-one-precommit-wakeup-per-write.

<a id="failure-commit-unknown"></a>

##### failure-commit-unknown

Caller retains exact operation request; task reads committed row if present; replay returns receipt and never emits a second logical event.

Class: COMMIT response lost. Source: transient. Requirement effect: preserves. Recovery: retry.

<a id="failure-rollback-task"></a>

##### failure-rollback-task

Root task exists but batch rolled back: acquire transaction-order lock, retry confirmed absence within the bounded window then finish without fanout or callback.

Class: Task exists but row rolled back. Source: environmental. Requirement effect: preserves. Recovery: none.

<a id="failure-fanout-partial"></a>

##### failure-fanout-partial

Retain current durable task through retryable failure; resume contiguous durable cursor, retry exact child/successor names and never double-count progress. Unknown queue outcome does not imply no task. No later authenticated request is needed while queue is healthy.

Class: child enqueue, successor enqueue, progress CAS or worker interruption before acknowledgment. Source: transient. Requirement effect: preserves. Recovery: retry.

#### Verification obligations

<a id="verify-atomic-selection"></a>

##### verify-atomic-selection

Extend real PostgreSQL adapter tests through Node HTTP/MCP; inject task port but use actual SQL rollback/CAS; supplemental pure before/after eligibility tests.

Tier: T2. Requirements: [req-meaning](#req-meaning), [req-recovery](#req-recovery), [req-idle](#req-idle), [req-integrity](#req-integrity). Status: **not executed**.

<a id="verify-wakeup-crash"></a>

##### verify-wakeup-crash

New two-process PostgreSQL crash harness plus deployed Cloud Tasks/Cloud Run acceptance. Long delay uses a controlled clock for absence budget; advisory lock is real. Hosted behavior remains unexecuted.

Tier: T2. Requirements: [req-meaning](#req-meaning), [req-recovery](#req-recovery), [req-idle](#req-idle), [req-integrity](#req-integrity). Status: **not executed**.

<a id="verify-enqueue-outage"></a>

##### verify-enqueue-outage

Inject queue failures in actual PostgreSQL/Node harness and verify task names/rows; hosted createTask dedup and fanout/latency require new acceptance evidence.

Tier: T2. Requirements: [req-meaning](#req-meaning), [req-recovery](#req-recovery), [req-idle](#req-idle), [req-integrity](#req-integrity). Status: **not executed**.

<a id="verify-batch-fanout"></a>

##### verify-batch-fanout

Add real PostgreSQL/Node two-process crash tests with a controllable healthy queue and many unique subscriptions/collaborations. Inject delay/failure after each child create, cursor commit, successor create and acknowledgment boundary. Actual Cloud Tasks create/ALREADY_EXISTS, OIDC and continuation behavior require target-environment acceptance; fixture results are not hosted proof.

Tier: T2. Requirements: [req-meaning](#req-meaning), [req-recovery](#req-recovery), [req-idle](#req-idle), [req-integrity](#req-integrity). Status: **not executed**.

#### Discriminating witnesses

<a id="witness-atomic-selection"></a>

##### witness-atomic-selection

Given Real PostgreSQL, shared application writes and subscriptions for users A/B and connections X/Y.

When Ask AI, approve, change linked Action, withdraw, reassign, reject stale CAS, roll back after task create, replay exact operation after lost response and Undo.

Expected:

- Only relevant connection receives one persisted logical event per changed collaboration/revision; Action-path writes included; rollback and replay add no event; receipts and user scope preserved.

Forbidden:

- Events outside transaction, unrelated-user or unrelated-connection hints, lost withdrawal hint, event from rejected write.

Effects: [observable-committed-hint](#observable-committed-hint). Verification: [verify-atomic-selection](#verify-atomic-selection).

<a id="witness-wakeup-crash"></a>

##### witness-wakeup-crash

Given Real PostgreSQL write transaction, controlled root wakeup adapter and fanout worker on a separate connection.

When Run root wakeup before COMMIT, delay originating transaction beyond absence window, then commit or roll back. Separately terminate the server immediately after COMMIT without any later client request.

Expected:

- Worker never classifies absence while origin lock is held; committed batch fans out; rolled-back batch never creates child deliveries; one confirmed root wakeup survives process exit.

Forbidden:

- Terminal absence result based only on elapsed time, waking from uncommitted row, requiring another request after confirmed enqueue.

Effects: [observable-durable-wakeup](#observable-durable-wakeup), [observable-committed-hint](#observable-committed-hint). Verification: [verify-wakeup-crash](#verify-wakeup-crash).

<a id="witness-enqueue-outage"></a>

##### witness-enqueue-outage

Given Root wakeup create times out or succeeds remotely with response lost.

When Commit, stop process, then perform authenticated read or refresh; repeat recovery concurrently.

Expected:

- Write succeeds and batch marker persists; next authenticated request retries exact root task name; bounded root-recovery batches converge; healthy fanout never waits for that recovery hook.

Forbidden:

- Failure of unrelated business write solely due to queue outage, duplicate event identity, scheduled scan, unconditional recovery claim during no-request outage.

Effects: [observable-conditional-recovery](#observable-conditional-recovery), [observable-durable-wakeup](#observable-durable-wakeup). Verification: [verify-enqueue-outage](#verify-enqueue-outage).

<a id="witness-batch-fanout"></a>

##### witness-batch-fanout

Given A healthy queue and valid subscriptions/affected collaborations produce substantially more than 20 deliveries, with child create latency such that all deliveries cannot fit in the old 3s write budget. Include concurrent duplicate root and continuation tasks.

When Commit shared-path write, assert exactly one precommit create, terminate immediately after COMMIT and issue no further client request. Execute bounded task invocations; crash after child create before cursor persistence, after cursor persistence before continuation create, and after continuation create before result recording. Also fail successor enqueue once, then restore queue.

Expected:

- Business write has the ordinary successful receipt without quota or fanout rejection; precommit create count remains one independent of membership size.
- Every committed eligible row is eventually covered by an idempotently named delivery task through pages of at most20/8s and confirmed successors; no client request starts recovery.
- No cursor advances past an unconfirmed row; no 2xx while remaining membership lacks a confirmed successor; failed/uncertain successor retains current task for retry.
- Crashes and duplicate tasks resume contiguous progress; stable event IDs, terminal delivery behavior, revision/CAS and user isolation remain intact.

Forbidden:

- Healthy fanout overflow classified as queue outage, silent orphan, newly imposed subscription quota, rejection of otherwise valid business write, per-child precommit create, or future capacity measurement treated as workload enforcement.

Effects: [observable-committed-hint](#observable-committed-hint), [observable-durable-wakeup](#observable-durable-wakeup). Verification: [verify-batch-fanout](#verify-batch-fanout).

<a id="contract-delivery"></a>

### Safe signed webhook delivery with revocation, expiry, concurrency and retry control.

Owner: component-worker. Dimension: security_boundary. Requirements: [req-delivery](#req-delivery), [req-security](#req-security), [req-recovery](#req-recovery), [req-idle](#req-idle). ADRs: [adr-mcp-events-module](#adr-mcp-events-module), [adr-mcp-events-wire](#adr-mcp-events-wire), [adr-mcp-events-authorization](#adr-mcp-events-authorization).

#### Decision rules

<a id="decision-task-ingress"></a>

##### decision-task-ingress

When POST /internal/webhook-delivery with valid task authority:

Expose POST /internal/webhook-fanout for root/continuation tasks with strict body {writeBatchId,ownerRouting,wakeupGeneration,position,createdAt}, and POST /internal/webhook-delivery for strict body {deliveryId,ownerRouting,enqueueGeneration,createdAt}. Validate configured task OIDC issuer, audience and exact dedicated account on both routes; reject additional fields and business OAuth/session credentials. Trust neither Cloud Tasks headers nor callback addresses in task input. Load all fanout membership and delivery callback state from user-bound committed rows. A public Cloud Run business service must enforce internal-route task authentication itself. Only configured runtime can enqueue; only configured task identity may invoke.

- Rationale: The service is public for business OAuth; IAM-only assumptions are insufficient for an internal route.
- Evidence mode: total; state: determinate
- Inputs: [input-task-authority](#input-task-authority), [input-delivery-generation](#input-delivery-generation)
- Effects: [observable-delivery-retry](#observable-delivery-retry)

<a id="decision-lease"></a>

##### decision-lease

When Committed pending delivery with current active subscription:

Acquire a durable conditional lease with fencing token for 60s; only its holder can update attempt/terminal state. Recheck subscription generation and expiry immediately before network initiation; Gate checks every attempt. Serialize subscription stop and send admission with a subscription-scoped advisory lock held through at most the 5s HTTPS request. Unsubscribe waits for an admitted attempt to finish, then stops. A stopped generation is never revived. Gate revocation cannot retract a POST already in flight; a no-positive-cache check is the linearization point, matching existing online authorization. After crash, expired lease permits retry with same eventId.

- Rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md S6/S7 and Gate online-check snapshot; atomic exactly-once external delivery is not claimed.
- Evidence mode: total; state: determinate
- Inputs: [input-delivery-generation](#input-delivery-generation), [input-gate-status](#input-gate-status), [input-task-authority](#input-task-authority)
- Effects: [observable-signed-send](#observable-signed-send), [observable-delivery-stop](#observable-delivery-stop), [observable-delivery-retry](#observable-delivery-retry)

<a id="decision-safe-https"></a>

##### decision-safe-https

When Before challenge and each delivery attempt:

Require HTTPS and forbid credentials, fragments, malformed/alternate numeric IPs, local hostnames and nonpublic literal addresses; validate all A/AAAA results including IPv4-mapped IPv6 and reserved/link-local/loopback/multicast ranges. Connect using a pinned validated IP with original hostname for TLS SNI/certificate validation and Host. Disable redirects, proxy-env fallback and alternate connection resolution; on redirect do not issue another request. Bound connect+TLS+response to 5s; callback response max4096 bytes. Re-resolve and revalidate each new connection. Controlled tests may inject a transport but production path cannot bypass the guard.

- Rationale: docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md requires public HTTPS and redirect rejection; pinning closes DNS rebinding.
- Evidence mode: total; state: determinate
- Inputs: [input-destination](#input-destination)
- Effects: [observable-signed-send](#observable-signed-send), [observable-delivery-stop](#observable-delivery-stop)

<a id="decision-sign"></a>

##### decision-sign

When Authorized attempt and decryptable current signing secret:

Use maintained Standard Webhooks compatible HMAC-SHA256 over eventId + dot + current Unix-seconds signing time + dot + exact UTF-8 body bytes. Header webhook-id equals eventId; webhook-timestamp is fresh signing time; webhook-signature uses v1,base64 signature(s) separated by spaces; X-MCP-Subscription-Id is deterministic subscription ID; Content-Type application/json. Serialize persisted event body once; no timestamp/body rewrite on retry. Verification has its own random webhook ID and signed verification body. On verified secret rotation keep previous encrypted secret for a 10-minute overlap, signing with old and new keys, then discard previous secret. No secret returned by methods or task payload.

- Rationale: docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md Standard Webhooks wire snapshot; body <=262144 bytes is validated before any POST.
- Evidence mode: total; state: determinate
- Inputs: [input-signing-key](#input-signing-key), [input-delivery-generation](#input-delivery-generation), [input-destination](#input-destination)
- Effects: [observable-signed-send](#observable-signed-send)

<a id="decision-attempt-result"></a>

##### decision-attempt-result

When Callback returns or transport fails:

2xx marks delivered and acknowledges task; 410 stops subscription and pending deliveries, 413 marks this delivery terminal and is not retried; other 4xx except 408/429 are permanent delivery failures. Network/timeouts, 408,429 and 5xx return retryable 503. Application sends at most 8 times and for at most 24h from event creation, counts admission durably before POST, and records exhausted terminal state afterward. Cloud Tasks retry config minBackoff10s maxBackoff600s maxDoublings6, maxAttempts100, maxRetryDuration24h; early absence/lock probes do not count as POST attempts. Return 204 for terminal/exhausted rows. Queue retries may be duplicated/out of order; if POST succeeded but recording failed, retry can repeat the same eventId. Consumers deduplicate eventId and reread current state; delivery never invokes a business transition.

- Rationale: Bounded retries and 410/413 exclusions are required; acknowledgment loss cannot establish exactly-once external effect.
- Evidence mode: total; state: determinate
- Inputs: [input-delivery-generation](#input-delivery-generation), [input-task-authority](#input-task-authority)
- Effects: [observable-delivery-stop](#observable-delivery-stop), [observable-delivery-retry](#observable-delivery-retry)

#### Operational inputs

<a id="input-delivery-generation"></a>

##### input-delivery-generation

- Kind: versioned_state
- Owner: component-webhook; producer: component-webhook
- Source: Committed subscription and delivery rows
- Acquire: At each authorized attempt, before the corresponding effect; retain until: Attempt finishes or lease expires
- Preservation: current_lookup; mutable before use: true
- Stability: Version/generation checks and explicit attempt lease; positive external authority is never cached.
- Invalidation: Stop or generation mismatch prevents new send; terminal rows acknowledge without sending.
- Unavailable: 503; preserve pending row
- Witnesses: [witness-delivery-status](#witness-delivery-status), [witness-delivery-races](#witness-delivery-races)

<a id="input-destination"></a>

##### input-destination

- Kind: information; data scope: single_value
- Owner: component-webhook; producer: component-webhook
- Source: Validated callback URL and injected DNS/HTTPS adapter
- Acquire: At each authorized attempt, before the corresponding effect; retain until: Connected TLS peer for each challenge or delivery
- Preservation: current_lookup; mutable before use: true
- Stability: Version/generation checks and explicit attempt lease; positive external authority is never cached.
- Invalidation: Resolve each attempt, classify every answer, pin selected public IP to actual socket; reject changed unsafe DNS and all redirects.
- Unavailable: Categorized verification failure or terminal unsafe-destination delivery stop
- Witnesses: [witness-https-guard](#witness-https-guard)

<a id="input-signing-key"></a>

##### input-signing-key

- Kind: information; data scope: single_value
- Owner: component-webhook; producer: component-webhook
- Source: Encrypted subscription secret and Secret Manager-injected encryption key ring
- Acquire: At each authorized attempt, before the corresponding effect; retain until: Exact attempt body bytes sent
- Preservation: version_bound; mutable before use: true
- Stability: Version/generation checks and explicit attempt lease; positive external authority is never cached.
- Invalidation: Unknown encryption key or failed AEAD is not an empty secret; retry unavailable key, escalate corrupt record; new secret invalidates proof and old signing overlap expires.
- Unavailable: No send; preserve durable pending state until bounded exhaustion
- Witnesses: [witness-signature-bytes](#witness-signature-bytes), [witness-delivery-races](#witness-delivery-races)

<a id="input-gate-status"></a>

##### input-gate-status

- Kind: authority
- Owner: component-gate; producer: component-gate
- Source: New resource-authenticated Gate validity API defined by contract-gate
- Acquire: At each authorized attempt, before the corresponding effect; retain until: Immediate callback initiation for that attempt
- Preservation: current_lookup; mutable before use: true
- Stability: Version/generation checks and explicit attempt lease; positive external authority is never cached.
- Invalidation: Invalid stops all subscriptions for that exact issuer/subject/connection. Outage or malformed response is unknown and retryable, never invalid or valid.
- Unavailable: No send; retry within delivery bounds
- Witnesses: [witness-gate-authority](#witness-gate-authority), [witness-delivery-races](#witness-delivery-races)

<a id="input-task-authority"></a>

##### input-task-authority

- Kind: authority
- Owner: component-worker; producer: component-worker
- Source: Cloud Tasks OIDC ID token validated against configured audience and exact dedicated task service-account identity
- Acquire: At each authorized attempt, before the corresponding effect; retain until: Internal request handling
- Preservation: capability_bound; mutable before use: false
- Stability: Version/generation checks and explicit attempt lease; positive external authority is never cached.
- Invalidation: Reject expired token, bad issuer/audience, wrong account, unsigned headers or attempts to use user OAuth/session on internal route.
- Unavailable: 401/403; no database scan or outbound request
- Witnesses: [witness-task-auth](#witness-task-auth)

#### Observable effects

<a id="observable-signed-send"></a>

##### observable-signed-send

Callback receives immutable identifier-only event with fresh Standard Webhooks signature on each attempt and stable eventId.

Scope: single. Inputs: [input-delivery-generation](#input-delivery-generation), [input-destination](#input-destination), [input-signing-key](#input-signing-key), [input-gate-status](#input-gate-status), [input-task-authority](#input-task-authority). All authority and payload inputs are checked at the stated effect boundary; unavailable values cannot authorize sending.

<a id="observable-delivery-stop"></a>

##### observable-delivery-stop

No new send starts after a checked stop/expiry/invalid connection; 410/413 and terminal deliveries acknowledge task without retry.

Scope: single. Inputs: [input-delivery-generation](#input-delivery-generation), [input-gate-status](#input-gate-status), [input-task-authority](#input-task-authority). All authority and payload inputs are checked at the stated effect boundary; unavailable values cannot authorize sending.

<a id="observable-delivery-retry"></a>

##### observable-delivery-retry

Transient failures retain stable bytes/ID and use bounded queue retries; duplicate tasks do not create a second concurrent send.

Scope: single. Inputs: [input-delivery-generation](#input-delivery-generation), [input-task-authority](#input-task-authority). All authority and payload inputs are checked at the stated effect boundary; unavailable values cannot authorize sending.

#### Invariants

- Generic lib/webhook has no domain/application imports; concrete DB, DNS, clock, IDs and HTTP are injected adapters. Lint positive/negative fixtures enforce this dependency direction.
- At most one live admitted send per subscription lock and delivery lease; task redelivery must not resurrect terminal state.
- Logs contain only bounded route/status/error categories and durations, never callback URLs, bodies, signing keys, subjects or bearer/OIDC tokens.
- Transient key/Gate/DB failure is uncertainty, never a revocation result.
- No positive Gate cache, no business bearer token or browser cookie stored for worker use.

#### Failure semantics

<a id="failure-callback-transient"></a>

##### failure-callback-transient

Record attempt result and retain pending state; fresh-signature retry, terminal after configured bounds.

Class: callback-transient. Source: transient. Requirement effect: preserves. Recovery: retry.

<a id="failure-unsafe-destination"></a>

##### failure-unsafe-destination

Do not connect to any unsafe address and stop this subscription with redacted category.

Class: unsafe-destination. Source: unsupported_input. Requirement effect: preserves. Recovery: none.

<a id="failure-post-unknown"></a>

##### failure-post-unknown

POST may have been accepted; retain stable eventId/body and retry within bounds; no claim of exactly-once external receipt.

Class: post-unknown. Source: transient. Requirement effect: preserves. Recovery: retry.

<a id="failure-authority-unknown"></a>

##### failure-authority-unknown

Gate/key/DB unavailable: do not send; retry. Invalid Gate response stops only the named connection.

Class: authority-unknown. Source: environmental. Requirement effect: preserves. Recovery: retry.

#### Verification obligations

<a id="verify-https-guard"></a>

##### verify-https-guard

Add real socket/resolver adapter suite; mock URL validation alone cannot close SSRF boundary.

Tier: T2. Requirements: [req-delivery](#req-delivery), [req-security](#req-security), [req-recovery](#req-recovery), [req-idle](#req-idle). Status: **not executed**.

<a id="verify-signature-bytes"></a>

##### verify-signature-bytes

Add known-vector pure tests and capture real adapter bytes; inspect encrypted DB row and redacted logs.

Tier: T2. Requirements: [req-delivery](#req-delivery), [req-security](#req-security), [req-recovery](#req-recovery), [req-idle](#req-idle). Status: **not executed**.

<a id="verify-delivery-status"></a>

##### verify-delivery-status

New actual PostgreSQL lease/CAS tests with HTTPS receiver and injected clock; configured Cloud Tasks backoff verified hosted separately.

Tier: T2. Requirements: [req-delivery](#req-delivery), [req-security](#req-security), [req-recovery](#req-recovery), [req-idle](#req-idle). Status: **not executed**.

<a id="verify-delivery-races"></a>

##### verify-delivery-races

Real PostgreSQL locking plus synthetic online Gate fixture; actual revocation and expiry must also be observed in Gate acceptance.

Tier: T2. Requirements: [req-delivery](#req-delivery), [req-security](#req-security), [req-recovery](#req-recovery), [req-idle](#req-idle). Status: **not executed**.

<a id="verify-task-auth"></a>

##### verify-task-auth

New Node HTTP auth tests; actual Cloud Tasks OIDC identity and IAM behavior remain deployed acceptance.

Tier: T2. Requirements: [req-delivery](#req-delivery), [req-security](#req-security), [req-recovery](#req-recovery), [req-idle](#req-idle). Status: **not executed**.

#### Discriminating witnesses

<a id="witness-https-guard"></a>

##### witness-https-guard

Given Real Node HTTPS adapter with controllable resolver and certificate fixture.

When Return public then private DNS answers, mixed A/AAAA, mapped IPv6, redirect to metadata address, proxy environment, bad TLS, stalled/oversize response.

Expected:

- No socket reaches a nonpublic address; actual connected IP matches validated result; redirects never followed; bounds enforced.

Forbidden:

- Validation followed by independent fetch resolution, private reconnect, proxy bypass, sensitive diagnostic logging.

Effects: [observable-signed-send](#observable-signed-send), [observable-delivery-stop](#observable-delivery-stop). Verification: [verify-https-guard](#verify-https-guard).

<a id="witness-signature-bytes"></a>

##### witness-signature-bytes

Given Known synthetic keys and captured exact HTTPS request bytes.

When Challenge, normal send, retry, verified key rotation, invalid base64, payload at size limit and above.

Expected:

- Independent Standard Webhooks verifier accepts exact bytes/header mapping; retry timestamp/signature fresh, body and ID stable; overlap carries both signatures only for 10m; oversize never sent.

Forbidden:

- Signing one serialization and sending another, stale timestamp, secret in logs/task/DB plaintext.

Effects: [observable-signed-send](#observable-signed-send). Verification: [verify-signature-bytes](#verify-signature-bytes).

<a id="witness-delivery-status"></a>

##### witness-delivery-status

Given Pending rows and callback responses 200,410,413,400,408,429,503 and disconnects.

When Deliver concurrently, lose acknowledgment after callback accepts, crash before persisting result, advance injected clock past retry/lifetime bounds.

Expected:

- One admitted concurrent send; stable eventId on possible retry duplicate; no retry after410/413; count/deadline bounds terminal; stopped/delivered rows acknowledge task.

Forbidden:

- Fresh ID after unknown result, unbounded retries or sends after observed expiry.

Effects: [observable-signed-send](#observable-signed-send), [observable-delivery-stop](#observable-delivery-stop), [observable-delivery-retry](#observable-delivery-retry). Verification: [verify-delivery-status](#verify-delivery-status).

<a id="witness-delivery-races"></a>

##### witness-delivery-races

Given Active subscription and delivery, Gate verifier with controllable responses.

When Race unsubscribe/refresh/secret rotation with send admission; revoke Gate before next attempt; make Gate unavailable.

Expected:

- Unsubscribe serializes after admitted send and prevents later sends; new attempt checks current generation/expiry and Gate; invalid stops exact connection; outage no send and no false revocation.

Forbidden:

- Post-unsubscribe new admission, stale secret/proof activation, cached Gate approval or cross-connection stop.

Effects: [observable-signed-send](#observable-signed-send), [observable-delivery-stop](#observable-delivery-stop), [observable-delivery-retry](#observable-delivery-retry). Verification: [verify-delivery-races](#verify-delivery-races).

<a id="witness-task-auth"></a>

##### witness-task-auth

Given Public Cloud Run-style HTTP surface and synthetic OIDC verifier.

When Invoke internal endpoint with no token, business OAuth, spoofed task headers, wrong audience/account, then valid service token.

Expected:

- Only configured task identity reaches delivery state/adapter.

Forbidden:

- Public internal route or Cloud Tasks header treated as authority.

Effects: [observable-delivery-retry](#observable-delivery-retry). Verification: [verify-task-auth](#verify-task-auth).

<a id="contract-gate"></a>

### Resource-authenticated online connection-validity boundary and separate Gate handoff.

Owner: component-gate. Dimension: integration_contract. Requirements: [req-delivery](#req-delivery), [req-security](#req-security). ADRs: [adr-mcp-events-authorization](#adr-mcp-events-authorization).

#### Decision rules

<a id="decision-gate-request"></a>

##### decision-gate-request

When Worker has durable subscription identity and trusted issuer configuration:

Define Gate SDK port checkConnection({subject,connectionId,clientId}): valid | invalid, with transport/auth failures thrown as unknown. Proposed Gate HTTP contract: POST /connections/check authenticated with the resource's existing introspection client authentication, JSON {subject,connection_id,client_id}; issuer is selected by pinned configuration, resource by authenticated resource identity. JSON 200 {valid:boolean}; valid true only for exact subject/client/connection, active approved OAuth connection, unexpired and not revoked, current account admission and resource grant. Unknown IDs and mismatches return valid:false without disclosing records. Requesting browser-session connection is invalid. 401/403 resource auth failure and 5xx/timeout/malformed response are unknown; never coerce to false. No token required or stored.

- Rationale: docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md Gate boundary authorizes defining this new resource-authenticated call; exact route is a proposed shared design contract, not an existing implementation claim.
- Evidence mode: total; state: determinate
- Inputs: [input-gate-resource-auth](#input-gate-resource-auth), [input-gate-connection-record](#input-gate-connection-record)
- Effects: [observable-gate-validity](#observable-gate-validity)

<a id="decision-gate-handoff"></a>

##### decision-gate-handoff

When Gate implementation/release is external to declared repository:

Caller must obtain Gate-side implementation and SDK contract acceptance before enabling production events. Weave implements the port and strict adapter against this proposed wire contract; synthetic fixtures permit local work in parallel, but hosted activation consumes the actual Gate release and is blocked until cross-repository contract agreement. No Gate checkout is read or modified here.

- Rationale: docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md explicitly assigns Gate implementation/release to a separate unit.
- Evidence mode: total; state: determinate
- Inputs: [input-gate-resource-auth](#input-gate-resource-auth), [input-gate-connection-record](#input-gate-connection-record)
- Effects: [observable-gate-validity](#observable-gate-validity)

#### Operational inputs

<a id="input-gate-resource-auth"></a>

##### input-gate-resource-auth

- Kind: authority
- Owner: component-gate; producer: component-gate
- Source: Configured Gate resource introspection credentials and trusted issuer/resource
- Acquire: At each authorized attempt, before the corresponding effect; retain until: Each connection validity query
- Preservation: capability_bound; mutable before use: false
- Stability: Version/generation checks and explicit attempt lease; positive external authority is never cached.
- Invalidation: Rotate via configured secret versions; credential rejection cannot become a valid/invalid connection result.
- Unavailable: 503 unknown; no send
- Witnesses: [witness-gate-authority](#witness-gate-authority)

<a id="input-gate-connection-record"></a>

##### input-gate-connection-record

- Kind: versioned_state
- Owner: component-gate; producer: component-gate
- Source: Gate current approved connection, subject admission, resource grant and expiry
- Acquire: At each authorized attempt, before the corresponding effect; retain until: Online response used immediately before delivery
- Preservation: current_lookup; mutable before use: true
- Stability: Version/generation checks and explicit attempt lease; positive external authority is never cached.
- Invalidation: Revocation/expiry/resource removal changes next query; never cached positive.
- Unavailable: Unknown for Gate outage/malformed response; not-valid only authoritative response
- Witnesses: [witness-gate-authority](#witness-gate-authority)

#### Observable effects

<a id="observable-gate-validity"></a>

##### observable-gate-validity

Worker gets either valid exact bound connection, invalid exact bound connection, or explicit unknown failure.

Scope: single. Inputs: [input-gate-resource-auth](#input-gate-resource-auth), [input-gate-connection-record](#input-gate-connection-record). All authority and payload inputs are checked at the stated effect boundary; unavailable values cannot authorize sending.

#### Invariants

- Connection is the revocation unit; clientId alone cannot select or validate a subscription.
- Verified durable subscription identity is the only query subject; user request arguments never choose it.
- Authorization linearizes at online Gate response; in-flight webhook cannot be unsent after later revocation.

#### Failure semantics

<a id="failure-gate-unavailable"></a>

##### failure-gate-unavailable

Timeout, invalid credential or malformed status yields unknown and retryable no-send, not approval or revocation.

Class: gate-unavailable. Source: environmental. Requirement effect: preserves. Recovery: retry.

#### Verification obligations

<a id="verify-gate-authority"></a>

##### verify-gate-authority

Existing Gate integration harness lacks this endpoint; Gate owner must extend actual Gate SDK/service tests and scripts/testing/verify-gate-integration.mjs before hosted acceptance; local fixture alone is insufficient.

Tier: T2. Requirements: [req-delivery](#req-delivery), [req-security](#req-security). Status: **not executed**.

#### Discriminating witnesses

<a id="witness-gate-authority"></a>

##### witness-gate-authority

Given Gate-side fixture and local Weave adapter using trusted resource credentials; two users/connections/resources.

When Check active, expired, revoked, wrong user/client/resource, browser connection, removed account admission, unauthenticated caller, outage and malformed response.

Expected:

- Only exact authorized OAuth connection returns true; invalid stops exact subscription; unknown prevents send and retains retry state.

Forbidden:

- ClientId-only validity, cross-resource enumeration, fail-open outage, positive cache.

Effects: [observable-gate-validity](#observable-gate-validity). Verification: [verify-gate-authority](#verify-gate-authority).

<a id="data-model"></a>

## Persistent data and lifecycle

### Constraints

Unique deterministic ID; user/connection-scoped access; state verifying/active/stopped. AES-256-GCM with unique random nonce and AAD user/id/generation; key ring injected from Secret Manager, never stored in DB. Retain old encryption keys until all rows reencrypted and migration verified.

### Fields

id, user_id, issuer, subject, client_id, connection_id, event_name, canonical_arguments, normalized_url, state, generation, expires_at, encrypted current/previous signing secret with key ID, verification cache proof hash/expiry

### Name

webhook_subscription

### Owner

component-webhook

### Constraints

Unique subscription generation/collaboration/revision; pending/sending/delivered/stopped/exhausted. Event body <=262144 bytes. FK references subscription; user binding included in every query. Secrets are referenced from subscription, not copied into tasks or outbox.

### Fields

delivery_id, user_id, write_batch_id, subscription_id, subscription_generation, event_id, immutable body bytes, enqueue_state, enqueue_generation, created_at, attempts, lease_token, lease_until, state, last_error_category

### Name

webhook_delivery

### Owner

component-commit

### Constraints

Unique user/operation/revision; immutable delivery membership fixed in business transaction and indexed by (user_id,write_batch_id,delivery_id). Cursor advances contiguously only after confirmed task creation or known terminal child. Preserve batch, member identities and progress through queue retry/dedup horizon; do not prune with business receipt history. After all deliveries terminal and at least7 days after batch creation, bounded cleanup during authenticated/worker requests may delete batch/deliveries together; no scheduled sweep.

### Fields

write_batch_id, user_id, operation_id, committed_revision, wakeup_generation, root_enqueue_state, created_at, fanout_cursor, fanout_state, lease_token, lease_until, successor_position

### Name

webhook_write_batch

### Owner

component-commit

<a id="state-transitions"></a>

## State transitions

### Acknowledgment uncertainty

HTTP delivery and PostgreSQL result cannot be atomic; duplicate attempts share eventId. This is one logical event, with possible transport duplicates.

### Delivery

pending/not_enqueued -> pending/enqueued -> sending with lease -> delivered|stopped|exhausted; transient send returns to pending; lease expiry permits retry with same eventId.

### Subscription

verifying -> active via challenge proof + generation CAS; active -> active refresh/verified secret rotation; active -> stopped on unsubscribe, invalid Gate,410 or unsafe URL; expiry checked on each attempt.

### Write batch

Within business transaction: pending/not_enqueued -> pending/root_confirmed on single precommit create; commit makes batch visible. Root/continuation: pending -> fanout lease -> contiguous cursor advancement -> confirmed successor or complete; failure before acknowledgment retains current task. Only precommit root outage waits for authenticated-request recovery.

<a id="decisions"></a>

## Decisions and alternatives

<a id="adr-mcp-events-wakeup"></a>

### Transactional pending state with a precommit durable wakeup

Status: proposed. Context: docs/changes/change-20261030-mcp-events-webhook/requirements.md; docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md; docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md#owner-decision-one-precommit-wakeup-per-write replaces per-delivery precommit enqueue.

Adopt the owner batch correction: persist pending deliveries and one immutable write-batch, attempt one named root Cloud Tasks wakeup before COMMIT, and gate fanout on committed state. Bounded fanout creates per-delivery tasks and confirms a cursor-named continuation before acknowledgment; only root enqueue outage/uncertainty uses next-request recovery.

Consequences:

- External task may outlive rollback; endpoint must be harmless for absent rows.
- Write-path queue work is one create independent of subscription count. Fanout adds persistent batch progress and continuation tasks only while committed work remains; there is no idle delivery process.
- Early absence must be classified behind the originating user lock.

Alternatives and dispositions:

- Postcommit enqueue only: Process exit after COMMIT loses the only wakeup.
- Scheduled sweep: Owner explicitly rejected idle scheduled work.
- Next-request-only recovery: Owner allows it only for enqueue failure.
- Fail business write when queue is down: Owner explicitly chose successful write plus conditional recovery.
- Per-delivery precommit tasks with a fixed time budget: Rejected by owner batch correction: no admitted fanout bound, so healthy queue could leave orphans.
- Subscription or valid-write admission quotas: Owner explicitly chose batch wakeup without these user-visible limits.
- Healthy-queue overflow uses next-request recovery: Owner explicitly retained only the precommit queue outage exception.

Decision inputs: decision-input-wakeup. Contracts: [contract-atomic-wakeup](#contract-atomic-wakeup).

<a id="adr-mcp-events-module"></a>

### Domain-independent delivery mechanics with domain-owned event meaning

Status: proposed. Context: docs/changes/change-20261030-mcp-events-webhook/requirements.md; docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md

Keep delivery mechanics in internal lib/webhook ports and adapters; keep assignmentReason eligibility and atomic outbox write in the shared state commit.

Consequences:

- No new service or published package now; extract when a second service needs it.
- Lint must enforce dependency direction; both UI and MCP writes are covered.

Alternatives and dispositions:

- SPA trigger: Misses MCP and atomic rollback/replay guarantees.
- Domain-aware generic package: Prevents reuse and conflates authorization with transport.
- Independent AI workflow engine: Outside State Store responsibility.

Decision inputs: decision-input-module. Contracts: [contract-events-wire](#contract-events-wire), [contract-atomic-wakeup](#contract-atomic-wakeup), [contract-delivery](#contract-delivery).

<a id="adr-mcp-events-wire"></a>

### Host-targeted webhook wire contract and conservative event catalog

Status: proposed. Context: docs/changes/change-20261030-mcp-events-webhook/requirements.md; docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md

Expose one collaboration_changed event with empty arguments, no replay and no listChanged; use OpenAI snapshot callback error -32015 without aliases; subscribe is connection-scoped and finite-lived.

Consequences:

- Wire follows supplied host snapshot rather than claiming all draft variants.
- No optional filters or replay backlog to maintain; subscribed caller rereads current state.
- Default24h/min5m/max7d TTL and bounded retry policy are server choices, not host guarantees.

Alternatives and dispositions:

- Draft -32027 alias or host negotiation: Adds unrequested compatibility behavior.
- Optional collaboration/action filters: No required observation justifies more identities and validation surface.
- listChanged capability: Catalog is static; no change source exists.
- Replay cursor implementation: Not required by supplied snapshot; null explicitly means no replay.

Decision inputs: decision-input-wire. Contracts: [contract-events-wire](#contract-events-wire), [contract-delivery](#contract-delivery).

<a id="adr-mcp-events-authorization"></a>

### Online connection authority for request-driven delivery

Status: proposed. Context: docs/changes/change-20261030-mcp-events-webhook/requirements.md; docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md

Persist verified identity references, never user bearer tokens; Gate adds resource-authenticated exact-connection check and worker validates dedicated task OIDC.

Consequences:

- Gate release is an external prerequisite; failure closes sending.
- No check can retract an already admitted callback on later revocation.

Alternatives and dispositions:

- Retain user token for delivery: Expires independently and increases credential retention.
- Trust stored subscription indefinitely: Revocation/expiry would not stop delivery.
- Trust Cloud Tasks headers: Public callers can forge headers.

Decision inputs: decision-input-authorization. Contracts: [contract-gate](#contract-gate), [contract-delivery](#contract-delivery).

<a id="decision-input-wakeup"></a>

### decision-input-wakeup

Disposition: adopted. docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md#owner-decision-one-precommit-wakeup-per-write authorizes one root wakeup and bounded fanout. F-WAKEUP-FANOUT-BOUND is addressed by changed meaning and a new healthy-queue crash witness, not by claiming an unobserved fanout bound. Existing independent verdict remains on its assessed candidate.

ADRs: [adr-mcp-events-wakeup](#adr-mcp-events-wakeup). Contracts: [contract-atomic-wakeup](#contract-atomic-wakeup).

<a id="decision-input-module"></a>

### decision-input-module

Disposition: adopted. docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md supplies owner authority and wire/Gate snapshots; ADR remains proposed pending independent assessment. Invalidated if its referenced contract witnesses fail.

ADRs: [adr-mcp-events-module](#adr-mcp-events-module). Contracts: [contract-events-wire](#contract-events-wire), [contract-atomic-wakeup](#contract-atomic-wakeup), [contract-delivery](#contract-delivery).

<a id="decision-input-wire"></a>

### decision-input-wire

Disposition: adopted. docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md supplies owner authority and wire/Gate snapshots; ADR remains proposed pending independent assessment. Invalidated if its referenced contract witnesses fail.

ADRs: [adr-mcp-events-wire](#adr-mcp-events-wire). Contracts: [contract-events-wire](#contract-events-wire), [contract-delivery](#contract-delivery).

<a id="decision-input-authorization"></a>

### decision-input-authorization

Disposition: adopted. docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md supplies owner authority and wire/Gate snapshots; ADR remains proposed pending independent assessment. Invalidated if its referenced contract witnesses fail.

ADRs: [adr-mcp-events-authorization](#adr-mcp-events-authorization). Contracts: [contract-gate](#contract-gate), [contract-delivery](#contract-delivery).

<a id="implementation-units"></a>

## Implementation units and dependencies

<a id="chunk-core"></a>

### chunk-core

Depends on: none.

#### Implement subscription protocol and generic webhook boundary

Modern-only event catalog, verified idempotent subscribe/refresh and unsubscribe.
Safe signed webhook delivery with revocation, expiry, concurrency and retry control.

- Contracts: [contract-events-wire](#contract-events-wire), [contract-delivery](#contract-delivery)
- Files: lib/webhook/, lib/adapters/postgres/webhook-store.ts, lib/server/node/webhook-https.ts, lib/mcp/dispatcher.ts, lib/mcp/protocol.ts, db/schema.ts, db/postgres/migrations/, tests/
- Boundary: Generic mechanics and subscription wire; worker composition is completed in chunk-integration. Pure decisions use injected readonly inputs; real adapters own effects.
- Output: lib/webhook/
lib/adapters/postgres/webhook-store.ts
lib/server/node/webhook-https.ts
lib/mcp/dispatcher.ts
lib/mcp/protocol.ts
db/schema.ts
db/postgres/migrations/
tests/
- Guidance: {"contract_refs": ["contract-events-wire", "contract-delivery"], "verification_refs": ["verify-wire-lifecycle", "verify-wire-isolation", "verify-https-guard", "verify-signature-bytes", "verify-delivery-status", "verify-delivery-races", "verify-task-auth"]}

Acceptance:

- [{"id": "witness-wire-lifecycle", "precondition": "Real Node HTTP/MCP server, PostgreSQL and controlled HTTPS callback with a synthetic whsec_ secret.", "stimulus": "Discover, list, subscribe twice with reordered argument keys, vary secret/TTL, wrong echo, timeout; unsubscribe twice and race unsubscribe with verification.", "expected_observables": ["Modern catalog/schema/envelopes correct; one active row and stable ID; bad proof does not activate; exact challenge header/body verified; finite TTL and null replay cursor; stale proof cannot win unsubscribe."], "forbidden_outcomes": ["Activation before proof, duplicate rows, -32027 alias, replay claim, changed action revision."]}]
- [{"id": "witness-wire-isolation", "precondition": "Two users, same client ID, two connections, and legacy resource subscribers.", "stimulus": "Attempt cross-connection unsubscribe and forged public identity headers; call modern methods through 2025 negotiation; refresh with Gate outage.", "expected_observables": ["No foreign row changes; legacy resource streams and modern listen keep baseline behavior; no events advertised to legacy; outage is unknown rather than valid."], "forbidden_outcomes": ["User chosen from arguments, revoked refresh, resource subscription regression."]}]
- [{"id": "witness-https-guard", "precondition": "Real Node HTTPS adapter with controllable resolver and certificate fixture.", "stimulus": "Return public then private DNS answers, mixed A/AAAA, mapped IPv6, redirect to metadata address, proxy environment, bad TLS, stalled/oversize response.", "expected_observables": ["No socket reaches a nonpublic address; actual connected IP matches validated result; redirects never followed; bounds enforced."], "forbidden_outcomes": ["Validation followed by independent fetch resolution, private reconnect, proxy bypass, sensitive diagnostic logging."]}]
- [{"id": "witness-signature-bytes", "precondition": "Known synthetic keys and captured exact HTTPS request bytes.", "stimulus": "Challenge, normal send, retry, verified key rotation, invalid base64, payload at size limit and above.", "expected_observables": ["Independent Standard Webhooks verifier accepts exact bytes/header mapping; retry timestamp/signature fresh, body and ID stable; overlap carries both signatures only for 10m; oversize never sent."], "forbidden_outcomes": ["Signing one serialization and sending another, stale timestamp, secret in logs/task/DB plaintext."]}]
- [{"id": "witness-delivery-status", "precondition": "Pending rows and callback responses 200,410,413,400,408,429,503 and disconnects.", "stimulus": "Deliver concurrently, lose acknowledgment after callback accepts, crash before persisting result, advance injected clock past retry/lifetime bounds.", "expected_observables": ["One admitted concurrent send; stable eventId on possible retry duplicate; no retry after410/413; count/deadline bounds terminal; stopped/delivered rows acknowledge task."], "forbidden_outcomes": ["Fresh ID after unknown result, unbounded retries or sends after observed expiry."]}]
- [{"id": "witness-delivery-races", "precondition": "Active subscription and delivery, Gate verifier with controllable responses.", "stimulus": "Race unsubscribe/refresh/secret rotation with send admission; revoke Gate before next attempt; make Gate unavailable.", "expected_observables": ["Unsubscribe serializes after admitted send and prevents later sends; new attempt checks current generation/expiry and Gate; invalid stops exact connection; outage no send and no false revocation."], "forbidden_outcomes": ["Post-unsubscribe new admission, stale secret/proof activation, cached Gate approval or cross-connection stop."]}]
- [{"id": "witness-task-auth", "precondition": "Public Cloud Run-style HTTP surface and synthetic OIDC verifier.", "stimulus": "Invoke internal endpoint with no token, business OAuth, spoofed task headers, wrong audience/account, then valid service token.", "expected_observables": ["Only configured task identity reaches delivery state/adapter."], "forbidden_outcomes": ["Public internal route or Cloud Tasks header treated as authority."]}]

#### Implement Gate validity adapter against shared contract

Resource-authenticated online connection-validity boundary and separate Gate handoff.

- Contracts: [contract-gate](#contract-gate)
- Files: lib/server/node/gate-connection.ts, tests/
- Boundary: Local port/adapter and fixture only. Gate service/SDK implementation and release belong to Gate owner, outside repository scope.
- Output: lib/server/node/gate-connection.ts
tests/
- Guidance: {"contract_refs": ["contract-gate"], "verification_refs": ["verify-gate-authority"]}

Acceptance:

- [{"id": "witness-gate-authority", "precondition": "Gate-side fixture and local Weave adapter using trusted resource credentials; two users/connections/resources.", "stimulus": "Check active, expired, revoked, wrong user/client/resource, browser connection, removed account admission, unauthenticated caller, outage and malformed response.", "expected_observables": ["Only exact authorized OAuth connection returns true; invalid stops exact subscription; unknown prevents send and retains retry state."], "forbidden_outcomes": ["ClientId-only validity, cross-resource enumeration, fail-open outage, positive cache."]}]

<a id="chunk-integration"></a>

### chunk-integration

Depends on: chunk-core.

#### Integrate atomic wakeup and authenticated task delivery

Domain event selection, atomic write-batch outbox and one precommit wakeup with durable bounded fanout.
Safe signed webhook delivery with revocation, expiry, concurrency and retry control.

- Contracts: [contract-atomic-wakeup](#contract-atomic-wakeup), [contract-delivery](#contract-delivery)
- Files: lib/adapters/postgres/action-store.ts, lib/application/ports.ts, lib/server/node/webhook-delivery.ts, lib/server/node/server.ts, lib/server/node/config.ts, infra/, tests/, scripts/testing/
- Boundary: {"in_scope": ["Authenticated 2026-07-28 events methods and collaboration_changed hints", "Subscription and outbox schema, guarded HTTPS, signatures, Cloud Tasks and Gate validity port", "Cross-repository Gate API handoff, migrations and actual-host acceptance obligations", "Narrow AGENTS.md and ARCHITECTURE.md responsibility correction and change-package projections"], "out_of_scope": ["Polling, push, listChanged, gap/terminated, replay history", "AI scheduling, starting or approving work, person notifications", "Changes to action API schemaVersion 2, resource subscriptions or Cloud Run billing", "Gate repository writes or deployment in this invocation; shared package publication"]}
- Output: lib/adapters/postgres/action-store.ts
lib/application/ports.ts
lib/server/node/webhook-delivery.ts
lib/server/node/server.ts
lib/server/node/config.ts
infra/
tests/
scripts/testing/
- Guidance: {"contract_refs": ["contract-atomic-wakeup", "contract-delivery"], "verification_refs": ["verify-atomic-selection", "verify-wakeup-crash", "verify-enqueue-outage", "verify-batch-fanout", "verify-https-guard", "verify-signature-bytes", "verify-delivery-status", "verify-delivery-races", "verify-task-auth"]}

Acceptance:

- Shared-path real PostgreSQL crash/replay/CAS/Undo/user-isolation witnesses pass.
- Internal task authority and actual socket destination controls are verified.
- No recovery timer or scheduled sweep.

<a id="chunk-acceptance"></a>

### chunk-acceptance

Depends on: chunk-integration.

#### Close deployment and host acceptance and materialize governing documents

Modern-only event catalog, verified idempotent subscribe/refresh and unsubscribe.
Domain event selection, atomic write-batch outbox and one precommit wakeup with durable bounded fanout.
Safe signed webhook delivery with revocation, expiry, concurrency and retry control.
Resource-authenticated online connection-validity boundary and separate Gate handoff.

- Contracts: [contract-events-wire](#contract-events-wire), [contract-atomic-wakeup](#contract-atomic-wakeup), [contract-delivery](#contract-delivery), [contract-gate](#contract-gate)
- Files: AGENTS.md, ARCHITECTURE.md, docs/technical/, docs/changes/change-20261030-mcp-events-webhook/, scripts/testing/
- Boundary: {"in_scope": ["Authenticated 2026-07-28 events methods and collaboration_changed hints", "Subscription and outbox schema, guarded HTTPS, signatures, Cloud Tasks and Gate validity port", "Cross-repository Gate API handoff, migrations and actual-host acceptance obligations", "Narrow AGENTS.md and ARCHITECTURE.md responsibility correction and change-package projections"], "out_of_scope": ["Polling, push, listChanged, gap/terminated, replay history", "AI scheduling, starting or approving work, person notifications", "Changes to action API schemaVersion 2, resource subscriptions or Cloud Run billing", "Gate repository writes or deployment in this invocation; shared package publication"]}
- Output: AGENTS.md
ARCHITECTURE.md
docs/technical/
docs/changes/change-20261030-mcp-events-webhook/
scripts/testing/
- Guidance: {"contract_refs": ["contract-events-wire", "contract-atomic-wakeup", "contract-delivery", "contract-gate"], "verification_refs": ["verify-wire-lifecycle", "verify-wire-isolation", "verify-atomic-selection", "verify-wakeup-crash", "verify-enqueue-outage", "verify-batch-fanout", "verify-https-guard", "verify-signature-bytes", "verify-delivery-status", "verify-delivery-races", "verify-task-auth", "verify-gate-authority"]}

Acceptance:

- pnpm check and pnpm build; existing resource stream/listen baseline and new webhook tests pass without skips.
- Actual Gate release, Cloud Tasks OIDC/dedup/retry/crash recovery, Neon and subscribed Work chat acceptance recorded against the same source/artifact/version.
- Requirements decision3 is replaced with consultation correction and authorized outage exception; existing unaffected scenarios retained.

<a id="outcome-boundaries"></a>

## Cross-repository outcome boundaries

<a id="goal-events"></a>

### goal-events

Subscribed authorized AI receives collaboration change hints with supported recovery.

Boundary: Weave public protocol and task delivery plus external Gate authority.

- All contract witnesses independently assessed.

<a id="goal-weave"></a>

### goal-weave

Weave implements subscription, outbox and task delivery contracts.

Boundary: Declared repository only.

- contract-events-wire, contract-atomic-wakeup and contract-delivery witnesses.

<a id="goal-gate"></a>

### goal-gate

Gate and SDK expose resource-authenticated current connection check.

Boundary: External Gate repository, separately allocated by caller.

- contract-gate and actual Gate integration witness; shared wire accepted.

<a id="goal-host"></a>

### goal-host

Hosted subscribed Work chat delivery established for exact source artifact.

Boundary: Authorized deployment and actual caller host, separately allocated by caller.

- Actual Gate release plus Cloud Tasks/Cloud Run/Neon and Work chat delivery evidence.

Containment:

- goal-events contains goal-weave
- goal-events contains goal-gate
- goal-events contains goal-host

Prerequisites:

- goal-host requires goal-weave: Acceptance consumes built and deployed implementation.
- goal-host requires goal-gate: Hosted delivery must consume released online authority; fixtures cannot establish revocation.

<a id="release"></a>

## Rollout, rollback and evidence limits

### Evidence limits

- This invocation only reads repository and writes candidate to authorized staging path; no code, tests, deployment or host acceptance executed.
- Wire and Gate facts are source-bound snapshots in consultation, not fresh external observations.
- Gate route is a proposed cross-repository design contract; caller owns agreement and release.
- Actual Cloud Tasks dedup retention, root and cursor-named successor identities, OIDC audience, retry scheduling and callback reachability require target-environment acceptance. No unobserved finite fanout capacity is used to close design: the root queue call count is structurally one and fanout iterates bounded pages.
- The owner batch correction addresses F-WAKEUP-FANOUT-BOUND in the revised candidate; independent reassessment is still required. The healthy-queue over-budget crash and partial-continuation witnesses are specified, not executed.

### Rollback

- Stop advertising/accepting new subscriptions, stop existing subscriptions under locks before rolling server back, and retain additive tables/migrations and encrypted keys.
- Drain or acknowledge terminal tasks before removing worker endpoint; never delete business data or reset hosted DB.
- Document possible in-flight POSTs and queue retry state; restore only with explicit operator release authorization.

### Rollout

- Baseline existing resource streams, HTTP/MCP and receipt behavior before migration.
- Apply additive versioned migrations with no destructive reset; preserve deployed identities and existing rows.
- Provision queue, task identity, IAM and secret key ring declaratively using ignored rendered settings; no deployment identifiers in tracked files.
- Release Gate contract first or in parallel; events enabled only after actual Gate check, encryption key, queue and task token validation are available.
- Deploy server and validate all new boundaries before host event discovery/subscribe acceptance.
- Materialize the same contract IDs into design-plan/design.md, spine.yaml, requirements/implementation/verification and durable ADR projections via authorized package runtime. Replace requirement decision3 with both owner corrections: one precommit write wakeup, bounded postcommit fanout/continuation, and the narrow root queue-outage exception.

