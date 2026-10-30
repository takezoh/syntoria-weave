---
change: change-20261030-mcp-events-webhook
functional_requirements:
- id: req-discovery
  priority: must
  statement: When an authenticated 2026-07-28 client discovers or lists events, the
    server shall expose the webhook-only event catalog and schemas with cursor pagination.
- id: req-subscription
  priority: must
  statement: When a verified client subscribes, the server shall authorize identity
    and arguments, verify a safe HTTPS callback and persist one idempotent expiring
    subscription; unsubscribe shall be authorized and idempotent.
- id: req-meaning
  priority: must
  statement: When a committed shared-path change affects collaboration work relevant
    to a subscribed connection, the server shall persist one identifier/revision-only
    logical event per subscription, collaboration and committed revision.
- id: req-recovery
  priority: must
  statement: When pending deliveries are produced, the transaction shall attempt exactly
    one durable write-batch wakeup before COMMIT. A confirmed wakeup shall survive
    process exit and fan out all committed pending rows through bounded invocations
    and durable continuations, without any later client request. Only precommit wakeup
    enqueue outage or uncertain enqueue permits conditional recovery on the next authenticated
    request, including refresh.
- id: req-idle
  priority: must
  statement: While no delivery or recovery request is outstanding, the service shall
    run no delivery process, polling, open stream or scheduled sweep, and shall preserve
    request-based Cloud Run billing.
- id: req-security
  priority: must
  statement: The service shall keep subscription and delivery state user/connection
    scoped; reject unsafe destinations and redirects; encrypt callback secrets; emit
    no content, credentials or callback URL in logs.
- id: req-delivery
  priority: must
  statement: When sending, the service shall check current subscription lifetime and
    Gate connection validity, sign exact serialized bytes with fresh attempt timestamp,
    retry transient failures within bounds and stop on revocation, expiry, unsubscribe,
    410 or 413.
- id: req-integrity
  priority: must
  statement: The change shall preserve schemaVersion 2, atomic CAS/receipts/history,
    identical replay, unknown-outcome recovery and existing resource subscriptions,
    without starting or approving any work.
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

Deliver identifier-only collaboration change hints to verified subscribed client connections without an idle delivery process, preserving shared-state write guarantees.

## Authority and effective behavior

The owner decisions in [delivery recovery and source snapshots](consultations/delivery-recovery-and-sources.md) replace the original postcommit/per-delivery enqueue wording. The effective contract uses one precommit wakeup per nonempty write, bounded postcommit fanout and a confirmed durable continuation before acknowledgment. Only precommit wakeup queue outage or uncertain enqueue permits next-authenticated-request recovery. No subscription quota, valid-write rejection, idle process or scheduled sweep is introduced.

<a id="req-discovery"></a>

## req-discovery

When an authenticated 2026-07-28 client discovers or lists events, the server shall expose the webhook-only event catalog and schemas with cursor pagination.

Type: event_driven; priority: must. Rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md S1; C6

<a id="req-subscription"></a>

## req-subscription

When a verified client subscribes, the server shall authorize identity and arguments, verify a safe HTTPS callback and persist one idempotent expiring subscription; unsubscribe shall be authorized and idempotent.

Type: event_driven; priority: must. Rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md S2; S7; C1

<a id="req-meaning"></a>

## req-meaning

When a committed shared-path change affects collaboration work relevant to a subscribed connection, the server shall persist one identifier/revision-only logical event per subscription, collaboration and committed revision.

Type: event_driven; priority: must. Rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md S3; C2-C5

<a id="req-recovery"></a>

## req-recovery

When pending deliveries are produced, the transaction shall attempt exactly one durable write-batch wakeup before COMMIT. A confirmed wakeup shall survive process exit and fan out all committed pending rows through bounded invocations and durable continuations, without any later client request. Only precommit wakeup enqueue outage or uncertain enqueue permits conditional recovery on the next authenticated request, including refresh.

Type: complex; priority: must. Rationale: docs/changes/change-20261030-mcp-events-webhook/consultations/delivery-recovery-and-sources.md#owner-decision-one-precommit-wakeup-per-write supersedes the earlier per-delivery precommit task decision and resolves normal-operation fanout; S5 and the queue-outage exception remain.

<a id="req-idle"></a>

## req-idle

While no delivery or recovery request is outstanding, the service shall run no delivery process, polling, open stream or scheduled sweep, and shall preserve request-based Cloud Run billing.

Type: state_driven; priority: must. Rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md S4 and owner correction

<a id="req-security"></a>

## req-security

The service shall keep subscription and delivery state user/connection scoped; reject unsafe destinations and redirects; encrypt callback secrets; emit no content, credentials or callback URL in logs.

Type: ubiquitous; priority: must. Rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md C1; C2; C4; repository constraints

<a id="req-delivery"></a>

## req-delivery

When sending, the service shall check current subscription lifetime and Gate connection validity, sign exact serialized bytes with fresh attempt timestamp, retry transient failures within bounds and stop on revocation, expiry, unsubscribe, 410 or 413.

Type: complex; priority: must. Rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md S5-S7 and supplied wire snapshot

<a id="req-integrity"></a>

## req-integrity

The change shall preserve schemaVersion 2, atomic CAS/receipts/history, identical replay, unknown-outcome recovery and existing resource subscriptions, without starting or approving any work.

Type: ubiquitous; priority: must. Rationale: docs/changes/change-20261030-mcp-events-webhook/requirements.md C3; C5; C6; repository contracts

## Observable acceptance

### witness-wire-lifecycle

Given Real Node HTTP/MCP server, PostgreSQL and controlled HTTPS callback with a synthetic whsec_ secret. When Discover, list, subscribe twice with reordered argument keys, vary secret/TTL, wrong echo, timeout; unsubscribe twice and race unsubscribe with verification. Then Modern catalog/schema/envelopes correct; one active row and stable ID; bad proof does not activate; exact challenge header/body verified; finite TTL and null replay cursor; stale proof cannot win unsubscribe. Reject Activation before proof, duplicate rows, -32027 alias, replay claim, changed action revision.

Requirements: req-discovery, req-subscription, req-security, req-integrity. Details: [design witness](design-plan/design.md#witness-wire-lifecycle).

### witness-wire-isolation

Given Two users, same client ID, two connections, and legacy resource subscribers. When Attempt cross-connection unsubscribe and forged public identity headers; call modern methods through 2025 negotiation; refresh with Gate outage. Then No foreign row changes; legacy resource streams and modern listen keep baseline behavior; no events advertised to legacy; outage is unknown rather than valid. Reject User chosen from arguments, revoked refresh, resource subscription regression.

Requirements: req-discovery, req-subscription, req-security, req-integrity. Details: [design witness](design-plan/design.md#witness-wire-isolation).

### witness-atomic-selection

Given Real PostgreSQL, shared application writes and subscriptions for users A/B and connections X/Y. When Ask AI, approve, change linked Action, withdraw, reassign, reject stale CAS, roll back after task create, replay exact operation after lost response and Undo. Then Only relevant connection receives one persisted logical event per changed collaboration/revision; Action-path writes included; rollback and replay add no event; receipts and user scope preserved. Reject Events outside transaction, unrelated-user or unrelated-connection hints, lost withdrawal hint, event from rejected write.

Requirements: req-meaning, req-recovery, req-idle, req-integrity. Details: [design witness](design-plan/design.md#witness-atomic-selection).

### witness-wakeup-crash

Given Real PostgreSQL write transaction, controlled root wakeup adapter and fanout worker on a separate connection. When Run root wakeup before COMMIT, delay originating transaction beyond absence window, then commit or roll back. Separately terminate the server immediately after COMMIT without any later client request. Then Worker never classifies absence while origin lock is held; committed batch fans out; rolled-back batch never creates child deliveries; one confirmed root wakeup survives process exit. Reject Terminal absence result based only on elapsed time, waking from uncommitted row, requiring another request after confirmed enqueue.

Requirements: req-meaning, req-recovery, req-idle, req-integrity. Details: [design witness](design-plan/design.md#witness-wakeup-crash).

### witness-enqueue-outage

Given Root wakeup create times out or succeeds remotely with response lost. When Commit, stop process, then perform authenticated read or refresh; repeat recovery concurrently. Then Write succeeds and batch marker persists; next authenticated request retries exact root task name; bounded root-recovery batches converge; healthy fanout never waits for that recovery hook. Reject Failure of unrelated business write solely due to queue outage, duplicate event identity, scheduled scan, unconditional recovery claim during no-request outage.

Requirements: req-meaning, req-recovery, req-idle, req-integrity. Details: [design witness](design-plan/design.md#witness-enqueue-outage).

### witness-batch-fanout

Given A healthy queue and valid subscriptions/affected collaborations produce substantially more than 20 deliveries, with child create latency such that all deliveries cannot fit in the old 3s write budget. Include concurrent duplicate root and continuation tasks. When Commit shared-path write, assert exactly one precommit create, terminate immediately after COMMIT and issue no further client request. Execute bounded task invocations; crash after child create before cursor persistence, after cursor persistence before continuation create, and after continuation create before result recording. Also fail successor enqueue once, then restore queue. Then Business write has the ordinary successful receipt without quota or fanout rejection; precommit create count remains one independent of membership size.; Every committed eligible row is eventually covered by an idempotently named delivery task through pages of at most20/8s and confirmed successors; no client request starts recovery.; No cursor advances past an unconfirmed row; no 2xx while remaining membership lacks a confirmed successor; failed/uncertain successor retains current task for retry.; Crashes and duplicate tasks resume contiguous progress; stable event IDs, terminal delivery behavior, revision/CAS and user isolation remain intact. Reject Healthy fanout overflow classified as queue outage, silent orphan, newly imposed subscription quota, rejection of otherwise valid business write, per-child precommit create, or future capacity measurement treated as workload enforcement.

Requirements: req-meaning, req-recovery, req-idle, req-integrity. Details: [design witness](design-plan/design.md#witness-batch-fanout).

### witness-https-guard

Given Real Node HTTPS adapter with controllable resolver and certificate fixture. When Return public then private DNS answers, mixed A/AAAA, mapped IPv6, redirect to metadata address, proxy environment, bad TLS, stalled/oversize response. Then No socket reaches a nonpublic address; actual connected IP matches validated result; redirects never followed; bounds enforced. Reject Validation followed by independent fetch resolution, private reconnect, proxy bypass, sensitive diagnostic logging.

Requirements: req-delivery, req-security, req-recovery, req-idle. Details: [design witness](design-plan/design.md#witness-https-guard).

### witness-signature-bytes

Given Known synthetic keys and captured exact HTTPS request bytes. When Challenge, normal send, retry, verified key rotation, invalid base64, payload at size limit and above. Then Independent Standard Webhooks verifier accepts exact bytes/header mapping; retry timestamp/signature fresh, body and ID stable; overlap carries both signatures only for 10m; oversize never sent. Reject Signing one serialization and sending another, stale timestamp, secret in logs/task/DB plaintext.

Requirements: req-delivery, req-security, req-recovery, req-idle. Details: [design witness](design-plan/design.md#witness-signature-bytes).

### witness-delivery-status

Given Pending rows and callback responses 200,410,413,400,408,429,503 and disconnects. When Deliver concurrently, lose acknowledgment after callback accepts, crash before persisting result, advance injected clock past retry/lifetime bounds. Then One admitted concurrent send; stable eventId on possible retry duplicate; no retry after410/413; count/deadline bounds terminal; stopped/delivered rows acknowledge task. Reject Fresh ID after unknown result, unbounded retries or sends after observed expiry.

Requirements: req-delivery, req-security, req-recovery, req-idle. Details: [design witness](design-plan/design.md#witness-delivery-status).

### witness-delivery-races

Given Active subscription and delivery, Gate verifier with controllable responses. When Race unsubscribe/refresh/secret rotation with send admission; revoke Gate before next attempt; make Gate unavailable. Then Unsubscribe serializes after admitted send and prevents later sends; new attempt checks current generation/expiry and Gate; invalid stops exact connection; outage no send and no false revocation. Reject Post-unsubscribe new admission, stale secret/proof activation, cached Gate approval or cross-connection stop.

Requirements: req-delivery, req-security, req-recovery, req-idle. Details: [design witness](design-plan/design.md#witness-delivery-races).

### witness-task-auth

Given Public Cloud Run-style HTTP surface and synthetic OIDC verifier. When Invoke internal endpoint with no token, business OAuth, spoofed task headers, wrong audience/account, then valid service token. Then Only configured task identity reaches delivery state/adapter. Reject Public internal route or Cloud Tasks header treated as authority.

Requirements: req-delivery, req-security, req-recovery, req-idle. Details: [design witness](design-plan/design.md#witness-task-auth).

### witness-gate-authority

Given Gate-side fixture and local Weave adapter using trusted resource credentials; two users/connections/resources. When Check active, expired, revoked, wrong user/client/resource, browser connection, removed account admission, unauthenticated caller, outage and malformed response. Then Only exact authorized OAuth connection returns true; invalid stops exact subscription; unknown prevents send and retains retry state. Reject ClientId-only validity, cross-resource enumeration, fail-open outage, positive cache.

Requirements: req-delivery, req-security. Details: [design witness](design-plan/design.md#witness-gate-authority).

## Scope and non-goals

- Authenticated 2026-07-28 events methods and collaboration_changed hints
- Subscription and outbox schema, guarded HTTPS, signatures, Cloud Tasks and Gate validity port
- Cross-repository Gate API handoff, migrations and actual-host acceptance obligations
- Narrow AGENTS.md and ARCHITECTURE.md responsibility correction and change-package projections

- Polling, push, listChanged, gap/terminated, replay history
- AI scheduling, starting or approving work, person notifications
- Changes to action API schemaVersion 2, resource subscriptions or Cloud Run billing
- Gate repository writes or deployment in this invocation; shared package publication

