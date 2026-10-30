---
adrs:
- adr-mcp-events-wakeup
- adr-mcp-events-module
- adr-mcp-events-wire
- adr-mcp-events-authorization
change: change-20261030-mcp-events-webhook
contract_projections:
- discretion: []
  id: contract-events-wire
  verifications:
  - verify-wire-lifecycle
  - verify-wire-isolation
- discretion: []
  id: contract-atomic-wakeup
  verifications:
  - verify-atomic-selection
  - verify-wakeup-crash
  - verify-enqueue-outage
  - verify-batch-fanout
- discretion: []
  id: contract-delivery
  verifications:
  - verify-https-guard
  - verify-signature-bytes
  - verify-delivery-status
  - verify-delivery-races
  - verify-task-auth
- discretion: []
  id: contract-gate
  verifications:
  - verify-gate-authority
contracts:
- contract-events-wire
- contract-atomic-wakeup
- contract-delivery
- contract-gate
decision_dispositions:
- adr_refs:
  - adr-mcp-events-wakeup
  contract_refs:
  - contract-atomic-wakeup
  decision_input_ref: decision-input-wakeup
  disposition: adopted
- adr_refs:
  - adr-mcp-events-module
  contract_refs:
  - contract-events-wire
  - contract-atomic-wakeup
  - contract-delivery
  decision_input_ref: decision-input-module
  disposition: adopted
- adr_refs:
  - adr-mcp-events-wire
  contract_refs:
  - contract-events-wire
  - contract-delivery
  decision_input_ref: decision-input-wire
  disposition: adopted
- adr_refs:
  - adr-mcp-events-authorization
  contract_refs:
  - contract-gate
  - contract-delivery
  decision_input_ref: decision-input-authorization
  disposition: adopted
milestones:
- id: chunk-core
- id: chunk-integration
- id: chunk-acceptance
reference_algorithms: []
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

A domain-independent webhook module owns callback verification, protected secrets and delivery state. The shared PostgreSQL commit owns event selection, immutable pending rows and one write-batch record. Exactly one named Cloud Tasks wakeup is attempted before COMMIT for a write producing deliveries, regardless of fanout. After commit, bounded idempotent fanout pages establish child delivery tasks and durable continuations before acknowledgment. Only precommit wakeup enqueue outage/uncertainty uses authenticated-request recovery. Gate supplies uncached connection validity.

The canonical [design](design-plan/design.md) and its spine preserve the same contract identifiers. Independent architecture approval covers planned behavior only; ADR lifecycle values remain as supplied.

## Responsibility contracts

### contract-events-wire

Modern-only event catalog, verified idempotent subscribe/refresh and unsubscribe.

Owner: component-protocol. Requirements: req-discovery, req-subscription, req-security, req-integrity. [Rules, inputs, effects, failures and witnesses](design-plan/design.md#contract-events-wire).

### contract-atomic-wakeup

Domain event selection, atomic write-batch outbox and one precommit wakeup with durable bounded fanout.

Owner: component-commit. Requirements: req-meaning, req-recovery, req-idle, req-integrity. [Rules, inputs, effects, failures and witnesses](design-plan/design.md#contract-atomic-wakeup).

### contract-delivery

Safe signed webhook delivery with revocation, expiry, concurrency and retry control.

Owner: component-worker. Requirements: req-delivery, req-security, req-recovery, req-idle. [Rules, inputs, effects, failures and witnesses](design-plan/design.md#contract-delivery).

### contract-gate

Resource-authenticated online connection-validity boundary and separate Gate handoff.

Owner: component-gate. Requirements: req-delivery, req-security. [Rules, inputs, effects, failures and witnesses](design-plan/design.md#contract-gate).

## Dependency-ordered work

### chunk-core

Depends on: none.

#### Implement subscription protocol and generic webhook boundary

Modern-only event catalog, verified idempotent subscribe/refresh and unsubscribe.
Safe signed webhook delivery with revocation, expiry, concurrency and retry control.

- Contracts: contract-events-wire, contract-delivery
- Files: lib/webhook/, lib/adapters/postgres/webhook-store.ts, lib/server/node/webhook-https.ts, lib/mcp/dispatcher.ts, lib/mcp/protocol.ts, db/schema.ts, db/postgres/migrations/, tests/
- Boundary: Generic mechanics and subscription wire; worker composition is completed in chunk-integration. Pure decisions use injected readonly inputs; real adapters own effects.

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

- Contracts: contract-gate
- Files: lib/server/node/gate-connection.ts, tests/
- Boundary: Local port/adapter and fixture only. Gate service/SDK implementation and release belong to Gate owner, outside repository scope.

Acceptance:

- [{"id": "witness-gate-authority", "precondition": "Gate-side fixture and local Weave adapter using trusted resource credentials; two users/connections/resources.", "stimulus": "Check active, expired, revoked, wrong user/client/resource, browser connection, removed account admission, unauthenticated caller, outage and malformed response.", "expected_observables": ["Only exact authorized OAuth connection returns true; invalid stops exact subscription; unknown prevents send and retains retry state."], "forbidden_outcomes": ["ClientId-only validity, cross-resource enumeration, fail-open outage, positive cache."]}]

### chunk-integration

Depends on: chunk-core.

#### Integrate atomic wakeup and authenticated task delivery

Domain event selection, atomic write-batch outbox and one precommit wakeup with durable bounded fanout.
Safe signed webhook delivery with revocation, expiry, concurrency and retry control.

- Contracts: contract-atomic-wakeup, contract-delivery
- Files: lib/adapters/postgres/action-store.ts, lib/application/ports.ts, lib/server/node/webhook-delivery.ts, lib/server/node/server.ts, lib/server/node/config.ts, infra/, tests/, scripts/testing/
- Boundary: {"in_scope": ["Authenticated 2026-07-28 events methods and collaboration_changed hints", "Subscription and outbox schema, guarded HTTPS, signatures, Cloud Tasks and Gate validity port", "Cross-repository Gate API handoff, migrations and actual-host acceptance obligations", "Narrow AGENTS.md and ARCHITECTURE.md responsibility correction and change-package projections"], "out_of_scope": ["Polling, push, listChanged, gap/terminated, replay history", "AI scheduling, starting or approving work, person notifications", "Changes to action API schemaVersion 2, resource subscriptions or Cloud Run billing", "Gate repository writes or deployment in this invocation; shared package publication"]}

Acceptance:

- Shared-path real PostgreSQL crash/replay/CAS/Undo/user-isolation witnesses pass.
- Internal task authority and actual socket destination controls are verified.
- No recovery timer or scheduled sweep.

### chunk-acceptance

Depends on: chunk-integration.

#### Close deployment and host acceptance and materialize governing documents

Modern-only event catalog, verified idempotent subscribe/refresh and unsubscribe.
Domain event selection, atomic write-batch outbox and one precommit wakeup with durable bounded fanout.
Safe signed webhook delivery with revocation, expiry, concurrency and retry control.
Resource-authenticated online connection-validity boundary and separate Gate handoff.

- Contracts: contract-events-wire, contract-atomic-wakeup, contract-delivery, contract-gate
- Files: AGENTS.md, ARCHITECTURE.md, docs/technical/, docs/changes/change-20261030-mcp-events-webhook/, scripts/testing/
- Boundary: {"in_scope": ["Authenticated 2026-07-28 events methods and collaboration_changed hints", "Subscription and outbox schema, guarded HTTPS, signatures, Cloud Tasks and Gate validity port", "Cross-repository Gate API handoff, migrations and actual-host acceptance obligations", "Narrow AGENTS.md and ARCHITECTURE.md responsibility correction and change-package projections"], "out_of_scope": ["Polling, push, listChanged, gap/terminated, replay history", "AI scheduling, starting or approving work, person notifications", "Changes to action API schemaVersion 2, resource subscriptions or Cloud Run billing", "Gate repository writes or deployment in this invocation; shared package publication"]}

Acceptance:

- pnpm check and pnpm build; existing resource stream/listen baseline and new webhook tests pass without skips.
- Actual Gate release, Cloud Tasks OIDC/dedup/retry/crash recovery, Neon and subscribed Work chat acceptance recorded against the same source/artifact/version.
- Requirements decision3 is replaced with consultation correction and authorized outage exception; existing unaffected scenarios retained.

## External prerequisite and adoption

Gate service/SDK agreement and release are separately allocated outside this repository. Hosted acceptance consumes that release and the built Weave implementation; local fixture work may proceed against the shared proposed contract. Caller owns allocation, deployment authority and acceptance. See [outcome boundaries](design-plan/design.md#outcome-boundaries).

## Evidence limits

- This invocation only reads repository and writes candidate to authorized staging path; no code, tests, deployment or host acceptance executed.
- Wire and Gate facts are source-bound snapshots in consultation, not fresh external observations.
- Gate route is a proposed cross-repository design contract; caller owns agreement and release.
- Actual Cloud Tasks dedup retention, root and cursor-named successor identities, OIDC audience, retry scheduling and callback reachability require target-environment acceptance. No unobserved finite fanout capacity is used to close design: the root queue call count is structurally one and fanout iterates bounded pages.
- The owner batch correction addresses F-WAKEUP-FANOUT-BOUND in the revised candidate; independent reassessment is still required. The healthy-queue over-budget crash and partial-continuation witnesses are specified, not executed.

## Rollback

- Stop advertising/accepting new subscriptions, stop existing subscriptions under locks before rolling server back, and retain additive tables/migrations and encrypted keys.
- Drain or acknowledge terminal tasks before removing worker endpoint; never delete business data or reset hosted DB.
- Document possible in-flight POSTs and queue retry state; restore only with explicit operator release authorization.

## Rollout

- Baseline existing resource streams, HTTP/MCP and receipt behavior before migration.
- Apply additive versioned migrations with no destructive reset; preserve deployed identities and existing rows.
- Provision queue, task identity, IAM and secret key ring declaratively using ignored rendered settings; no deployment identifiers in tracked files.
- Release Gate contract first or in parallel; events enabled only after actual Gate check, encryption key, queue and task token validation are available.
- Deploy server and validate all new boundaries before host event discovery/subscribe acceptance.
- Materialize the same contract IDs into design-plan/design.md, spine.yaml, requirements/implementation/verification and durable ADR projections via authorized package runtime. Replace requirement decision3 with both owner corrections: one precommit write wakeup, bounded postcommit fanout/continuation, and the narrow root queue-outage exception.

