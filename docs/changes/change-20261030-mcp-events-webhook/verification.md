---
change: change-20261030-mcp-events-webhook
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

Independent architecture assessment: **approved**. The revised architecture is sufficient for the delegated technical-design outcome. Independent reassessment of the whole candidate found no remaining material design defect: the current repository consultation authorizes one precommit wakeup per nonempty write, immutable committed batch membership, and bounded idempotent fanout with durable continuation; these remove the prior unbounded precommit network fanout premise. Contiguous cursor advancement, exact-name retries, fencing and retention preserve recovery across partial effects, while the current task remains retryable until a successor is confirmed or membership is complete. Responsibility separation remains justified: domain eligibility and atomic receipt/outbox composition belong to the shared commit, domain-independent subscription/signing/HTTPS mechanics to the webhook module, and task authentication and online Gate authority to their adapters. The selected wire behavior, isolation, revocation/expiry, rollback/replay, unknown results, bounded callback retries and unchanged resource transports have discriminating verification obligations. The supplied pursuit has no unprocessed returns; its earlier recovery question is addressed by the current owner corrections rather than historical acceptance. Approval covers the architecture and planned verification, not implemented or deployed behavior. Actual Gate contract agreement/release, Cloud Tasks identity/dedup/retry behavior, Neon and subscribed Work-chat acceptance remain explicit release prerequisites. No repository writes, runtime tests, deployments or external observations were performed.

No implementation/runtime/host witness below has been executed by this design invocation. A passing document/schema check establishes representation consistency only.

## Resolved architectural finding

### F-WAKEUP-FANOUT-BOUND

The current candidate replaces fanout-proportional precommit createTask calls with exactly one named write-batch wakeup under the explicit owner decision in the current repository consultation. All child membership is persisted in the business transaction; postcommit fanout processes at most 20 rows or 8 seconds per invocation, advances only across confirmed children, and confirms a cursor-named successor before acknowledging remaining work. Failure or uncertainty retains the current durable task for exact-name retry. Healthy-queue fanout no longer requires an unobserved admission bound, new subscription quotas, rejected valid writes or a later client request. witness-batch-fanout specifically distinguishes the original failure using more than one page, latency exceeding the old write budget, process exit immediately after COMMIT, no later client request, duplicate tasks and crashes across child/cursor/successor persistence. This resolves the architectural finding; the witness remains an implementation and hosted verification obligation, not an executed result.

The source owner decision is retained in [the consultation](consultations/delivery-recovery-and-sources.md#owner-decision-one-precommit-wakeup-per-write); this resolution is not runtime acceptance.

## Planned verification matrix

### contract-events-wire

#### verify-wire-lifecycle

Status: **not executed**. Tier: T2. Extend real PostgreSQL HTTP/MCP fixture and actual HTTPS callback adapter fixture; existing scripts/testing/verify-node-built.mjs is available but event webhook assertions must be added.

Requirements: req-discovery, req-subscription, req-security, req-integrity.

[Canonical witness](design-plan/design.md#witness-wire-lifecycle): witness-wire-lifecycle

Given Real Node HTTP/MCP server, PostgreSQL and controlled HTTPS callback with a synthetic whsec_ secret.

When Discover, list, subscribe twice with reordered argument keys, vary secret/TTL, wrong echo, timeout; unsubscribe twice and race unsubscribe with verification.

Expected:

- Modern catalog/schema/envelopes correct; one active row and stable ID; bad proof does not activate; exact challenge header/body verified; finite TTL and null replay cursor; stale proof cannot win unsubscribe.

Forbidden:

- Activation before proof, duplicate rows, -32027 alias, replay claim, changed action revision.

#### verify-wire-isolation

Status: **not executed**. Tier: T2. Existing real PostgreSQL user-scope and built HTTP/MCP runners plus new cross-connection event cases.

Requirements: req-discovery, req-subscription, req-security, req-integrity.

[Canonical witness](design-plan/design.md#witness-wire-isolation): witness-wire-isolation

Given Two users, same client ID, two connections, and legacy resource subscribers.

When Attempt cross-connection unsubscribe and forged public identity headers; call modern methods through 2025 negotiation; refresh with Gate outage.

Expected:

- No foreign row changes; legacy resource streams and modern listen keep baseline behavior; no events advertised to legacy; outage is unknown rather than valid.

Forbidden:

- User chosen from arguments, revoked refresh, resource subscription regression.

### contract-atomic-wakeup

#### verify-atomic-selection

Status: **not executed**. Tier: T2. Extend real PostgreSQL adapter tests through Node HTTP/MCP; inject task port but use actual SQL rollback/CAS; supplemental pure before/after eligibility tests.

Requirements: req-meaning, req-recovery, req-idle, req-integrity.

[Canonical witness](design-plan/design.md#witness-atomic-selection): witness-atomic-selection

Given Real PostgreSQL, shared application writes and subscriptions for users A/B and connections X/Y.

When Ask AI, approve, change linked Action, withdraw, reassign, reject stale CAS, roll back after task create, replay exact operation after lost response and Undo.

Expected:

- Only relevant connection receives one persisted logical event per changed collaboration/revision; Action-path writes included; rollback and replay add no event; receipts and user scope preserved.

Forbidden:

- Events outside transaction, unrelated-user or unrelated-connection hints, lost withdrawal hint, event from rejected write.

#### verify-wakeup-crash

Status: **not executed**. Tier: T2. New two-process PostgreSQL crash harness plus deployed Cloud Tasks/Cloud Run acceptance. Long delay uses a controlled clock for absence budget; advisory lock is real. Hosted behavior remains unexecuted.

Requirements: req-meaning, req-recovery, req-idle, req-integrity.

[Canonical witness](design-plan/design.md#witness-wakeup-crash): witness-wakeup-crash

Given Real PostgreSQL write transaction, controlled root wakeup adapter and fanout worker on a separate connection.

When Run root wakeup before COMMIT, delay originating transaction beyond absence window, then commit or roll back. Separately terminate the server immediately after COMMIT without any later client request.

Expected:

- Worker never classifies absence while origin lock is held; committed batch fans out; rolled-back batch never creates child deliveries; one confirmed root wakeup survives process exit.

Forbidden:

- Terminal absence result based only on elapsed time, waking from uncommitted row, requiring another request after confirmed enqueue.

#### verify-enqueue-outage

Status: **not executed**. Tier: T2. Inject queue failures in actual PostgreSQL/Node harness and verify task names/rows; hosted createTask dedup and fanout/latency require new acceptance evidence.

Requirements: req-meaning, req-recovery, req-idle, req-integrity.

[Canonical witness](design-plan/design.md#witness-enqueue-outage): witness-enqueue-outage

Given Root wakeup create times out or succeeds remotely with response lost.

When Commit, stop process, then perform authenticated read or refresh; repeat recovery concurrently.

Expected:

- Write succeeds and batch marker persists; next authenticated request retries exact root task name; bounded root-recovery batches converge; healthy fanout never waits for that recovery hook.

Forbidden:

- Failure of unrelated business write solely due to queue outage, duplicate event identity, scheduled scan, unconditional recovery claim during no-request outage.

#### verify-batch-fanout

Status: **not executed**. Tier: T2. Add real PostgreSQL/Node two-process crash tests with a controllable healthy queue and many unique subscriptions/collaborations. Inject delay/failure after each child create, cursor commit, successor create and acknowledgment boundary. Actual Cloud Tasks create/ALREADY_EXISTS, OIDC and continuation behavior require target-environment acceptance; fixture results are not hosted proof.

Requirements: req-meaning, req-recovery, req-idle, req-integrity.

[Canonical witness](design-plan/design.md#witness-batch-fanout): witness-batch-fanout

Given A healthy queue and valid subscriptions/affected collaborations produce substantially more than 20 deliveries, with child create latency such that all deliveries cannot fit in the old 3s write budget. Include concurrent duplicate root and continuation tasks.

When Commit shared-path write, assert exactly one precommit create, terminate immediately after COMMIT and issue no further client request. Execute bounded task invocations; crash after child create before cursor persistence, after cursor persistence before continuation create, and after continuation create before result recording. Also fail successor enqueue once, then restore queue.

Expected:

- Business write has the ordinary successful receipt without quota or fanout rejection; precommit create count remains one independent of membership size.
- Every committed eligible row is eventually covered by an idempotently named delivery task through pages of at most20/8s and confirmed successors; no client request starts recovery.
- No cursor advances past an unconfirmed row; no 2xx while remaining membership lacks a confirmed successor; failed/uncertain successor retains current task for retry.
- Crashes and duplicate tasks resume contiguous progress; stable event IDs, terminal delivery behavior, revision/CAS and user isolation remain intact.

Forbidden:

- Healthy fanout overflow classified as queue outage, silent orphan, newly imposed subscription quota, rejection of otherwise valid business write, per-child precommit create, or future capacity measurement treated as workload enforcement.

### contract-delivery

#### verify-https-guard

Status: **not executed**. Tier: T2. Add real socket/resolver adapter suite; mock URL validation alone cannot close SSRF boundary.

Requirements: req-delivery, req-security, req-recovery, req-idle.

[Canonical witness](design-plan/design.md#witness-https-guard): witness-https-guard

Given Real Node HTTPS adapter with controllable resolver and certificate fixture.

When Return public then private DNS answers, mixed A/AAAA, mapped IPv6, redirect to metadata address, proxy environment, bad TLS, stalled/oversize response.

Expected:

- No socket reaches a nonpublic address; actual connected IP matches validated result; redirects never followed; bounds enforced.

Forbidden:

- Validation followed by independent fetch resolution, private reconnect, proxy bypass, sensitive diagnostic logging.

#### verify-signature-bytes

Status: **not executed**. Tier: T2. Add known-vector pure tests and capture real adapter bytes; inspect encrypted DB row and redacted logs.

Requirements: req-delivery, req-security, req-recovery, req-idle.

[Canonical witness](design-plan/design.md#witness-signature-bytes): witness-signature-bytes

Given Known synthetic keys and captured exact HTTPS request bytes.

When Challenge, normal send, retry, verified key rotation, invalid base64, payload at size limit and above.

Expected:

- Independent Standard Webhooks verifier accepts exact bytes/header mapping; retry timestamp/signature fresh, body and ID stable; overlap carries both signatures only for 10m; oversize never sent.

Forbidden:

- Signing one serialization and sending another, stale timestamp, secret in logs/task/DB plaintext.

#### verify-delivery-status

Status: **not executed**. Tier: T2. New actual PostgreSQL lease/CAS tests with HTTPS receiver and injected clock; configured Cloud Tasks backoff verified hosted separately.

Requirements: req-delivery, req-security, req-recovery, req-idle.

[Canonical witness](design-plan/design.md#witness-delivery-status): witness-delivery-status

Given Pending rows and callback responses 200,410,413,400,408,429,503 and disconnects.

When Deliver concurrently, lose acknowledgment after callback accepts, crash before persisting result, advance injected clock past retry/lifetime bounds.

Expected:

- One admitted concurrent send; stable eventId on possible retry duplicate; no retry after410/413; count/deadline bounds terminal; stopped/delivered rows acknowledge task.

Forbidden:

- Fresh ID after unknown result, unbounded retries or sends after observed expiry.

#### verify-delivery-races

Status: **not executed**. Tier: T2. Real PostgreSQL locking plus synthetic online Gate fixture; actual revocation and expiry must also be observed in Gate acceptance.

Requirements: req-delivery, req-security, req-recovery, req-idle.

[Canonical witness](design-plan/design.md#witness-delivery-races): witness-delivery-races

Given Active subscription and delivery, Gate verifier with controllable responses.

When Race unsubscribe/refresh/secret rotation with send admission; revoke Gate before next attempt; make Gate unavailable.

Expected:

- Unsubscribe serializes after admitted send and prevents later sends; new attempt checks current generation/expiry and Gate; invalid stops exact connection; outage no send and no false revocation.

Forbidden:

- Post-unsubscribe new admission, stale secret/proof activation, cached Gate approval or cross-connection stop.

#### verify-task-auth

Status: **not executed**. Tier: T2. New Node HTTP auth tests; actual Cloud Tasks OIDC identity and IAM behavior remain deployed acceptance.

Requirements: req-delivery, req-security, req-recovery, req-idle.

[Canonical witness](design-plan/design.md#witness-task-auth): witness-task-auth

Given Public Cloud Run-style HTTP surface and synthetic OIDC verifier.

When Invoke internal endpoint with no token, business OAuth, spoofed task headers, wrong audience/account, then valid service token.

Expected:

- Only configured task identity reaches delivery state/adapter.

Forbidden:

- Public internal route or Cloud Tasks header treated as authority.

### contract-gate

#### verify-gate-authority

Status: **not executed**. Tier: T2. Existing Gate integration harness lacks this endpoint; Gate owner must extend actual Gate SDK/service tests and scripts/testing/verify-gate-integration.mjs before hosted acceptance; local fixture alone is insufficient.

Requirements: req-delivery, req-security.

[Canonical witness](design-plan/design.md#witness-gate-authority): witness-gate-authority

Given Gate-side fixture and local Weave adapter using trusted resource credentials; two users/connections/resources.

When Check active, expired, revoked, wrong user/client/resource, browser connection, removed account admission, unauthenticated caller, outage and malformed response.

Expected:

- Only exact authorized OAuth connection returns true; invalid stops exact subscription; unknown prevents send and retains retry state.

Forbidden:

- ClientId-only validity, cross-resource enumeration, fail-open outage, positive cache.

## Required checks and evidence boundaries

- Code changes require pnpm check and pnpm build; do not treat skipped or unexecuted tests as passes.
- MCP-to-storage acceptance must exercise real Node HTTP/MCP with the real PostgreSQL adapter. Existing fixtures and scripts/testing/verify-node-built.mjs are available seams but require the new webhook assertions.
- Synthetic Gate/queue/HTTPS fixtures establish only their local boundary; actual Gate service/SDK, Cloud Tasks OIDC and dedup/retry/continuation behavior, hosted Neon, and subscribed Work chat require separate acceptance.
- Associate source commit, artifact, version/deployment and host results; keep real deployment identifiers in ignored local files, never in tracked evidence.

## Remaining evidence limits

- This invocation only reads repository and writes candidate to authorized staging path; no code, tests, deployment or host acceptance executed.
- Wire and Gate facts are source-bound snapshots in consultation, not fresh external observations.
- Gate route is a proposed cross-repository design contract; caller owns agreement and release.
- Actual Cloud Tasks dedup retention, root and cursor-named successor identities, OIDC audience, retry scheduling and callback reachability require target-environment acceptance. No unobserved finite fanout capacity is used to close design: the root queue call count is structurally one and fanout iterates bounded pages.
- The owner batch correction addresses F-WAKEUP-FANOUT-BOUND in the revised candidate; independent reassessment is still required. The healthy-queue over-budget crash and partial-continuation witnesses are specified, not executed.


## chunk-core execution record (2026-10-30)

Source base: commit `529a084` plus the uncommitted chunk-core changes. Local runners only; nothing was deployed.

| Evidence | Result |
| --- | --- |
| `pnpm check` (ESLint, TypeScript, all suites) | 716 tests, 716 passed, 0 failed, cancelled, skipped or TODO |
| `pnpm build` | Passed |
| `tests/webhook/mechanics.test.mjs` | Address classification, callback URL normalization, `whsec_` parsing, the Standard Webhooks reference signature vector, identity and lifetime rules, verification before activation, refresh without a new challenge, secret rotation overlap, unsubscribe racing a verification, invalid input before any request |
| `tests/webhook/https-transport.test.mjs` | Real Node TLS server: pinned validated address with hostname certificate check, nonpublic, mixed or mapped DNS answers rejected before connecting, redirects returned without a second request, response bound, timeouts, certificate name mismatch. The network is substituted at the connector so the fixture receives the pinned connection. |
| `tests/webhook/gate-connection.test.mjs` | Proposed Gate check adapter against a fake `fetch`: exact request shape, no positive cache, outages and malformed answers are unknown |
| `tests/postgres/webhook-subscriptions.test.mjs` | Real Node HTTP/MCP server and PostgreSQL 17: modern-only `events` capability and methods, `Mcp-Name` binding, idempotent subscribe and refresh, rotation, idempotent unsubscribe, `-32015` reasons, no receipts written, connection and user isolation, forged identity headers ignored, revoked bearer rejected, compare-and-swap races in the real adapter |
| Architecture harness | `lib/webhook/` imports only `lib/webhook/` and is pure; the PostgreSQL store and composition helper sit on exact capability edges |

Deviations and limits:

- Signing secrets are sealed with AES-256-GCM using the subscription ID as additional data. The design named user, ID and generation. The ID already binds issuer, subject, client, connection, event, URL and arguments; the generation is omitted so the previous secret stays readable during the rotation overlap.
- `main.ts` does not compose events yet. Production advertises no `events` capability until chunk-integration adds delivery, the key ring configuration, Cloud Tasks and the actual Gate check.
- The Gate connection check implements the proposed contract only. No Gate release exists, and the hosted check, Cloud Tasks, Neon and ChatGPT Work chat acceptance remain unexecuted.

## chunk-integration and Gate execution record (2026-10-30)

Weave source base `529a084` plus uncommitted changes; Gate repository base `696ae00` plus uncommitted changes. Nothing was deployed or applied with Terraform.

| Evidence | Result |
| --- | --- |
| Weave `pnpm check` | 728 tests, 728 passed, 0 failed, cancelled, skipped or TODO |
| Weave `pnpm build` and `pnpm test:node:built` | Passed; the built process starts with the now-required webhook settings |
| `tests/domain/collaboration-events.test.mjs` | Relevance before or after, reassignment and withdrawal reach the former handler, the writer is not notified, Action status changes re-evaluate linked records |
| `tests/webhook/task-transport.test.mjs` | Cloud Tasks request shape with OIDC token, existing names count as created, metadata token reuse; only a Google-signed token for the task identity and audience authenticates |
| `tests/postgres/webhook-delivery.test.mjs` | Real server and PostgreSQL: one precommit wakeup per write, fan-out, identifier-only signed delivery verified against the subscriber's secret, duplicate tasks send nothing, identical replay records no event, rolled-back batches acknowledged, retries keep `eventId`, Gate unknown sends nothing, Gate invalid and 410 stop subscriptions, unsubscribe stops pending deliveries, queue outage recovered on the next authenticated request |
| Gate `npm test` | 81 passed, including the request parser and the SDK `createGateConnections` client |
| Gate integration against the local Firestore Emulator | Passed: exact active connection is valid; other client, account, unknown ID and revoked connection are not; missing or wrong resource credentials 401, malformed 400, oversized 413 |

Refinements made during implementation:

- Only status changes of a linked Action re-evaluate records; other Action edits do not concern subscribers.
- The writing connection is never notified of its own change, so an AI reporting progress does not wake itself.
- No compatibility paths: the webhook settings are required at startup, and runtime grants and test fixtures describe only the current schema.

Not executed: `terraform validate` (no Terraform binary here), hosted Cloud Tasks OIDC and retry behavior, the Gate release, Neon, and a subscribed ChatGPT Work chat.

## Production release

On 2026-10-30, source `e46d9d6`, pushed to main as a fast-forward, was released as revision `weave-api-events-e46d9d6` after Gate `485f7ba` ([release record](../../evidence/20261030-mcp-events-release/release.json)).

- The queue, task identity, key ring secret and their grants were created with gcloud to match `infra/main.tf`; this environment has no Terraform state.
- Migration `weave-migrator-lqk4b` applied 0013 and 0014. `grant-runtime` stopped with the known 42501 at `ALTER ROLE`, and a read-only check confirmed the runtime role's SELECT, INSERT and UPDATE on all three webhook tables.
- The candidate passed startup, liveness and readiness without traffic, then took 100%. Public checks: readiness 200, invalid MCP bearer 401 with a challenge, metadata 200, unauthenticated session 401, SPA preflight 204, untrusted preflight 403, and every internal webhook route 401 without a valid task token or with a cookie.

Not verified in production: a subscribed ChatGPT Work chat receiving `collaboration_changed`, Cloud Tasks OIDC acceptance and retries, Gate's check with Weave's resource credentials, and `terraform validate`.
