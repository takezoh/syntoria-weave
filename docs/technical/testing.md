# Verification design

## Environment and harness selection

Verify the actual responsibility boundary. Pure tests establish deterministic behavior; fakes establish orchestration; real PostgreSQL establishes storage semantics; Node HTTP/MCP establishes transport composition; deployed Cloud Run/Neon establishes hosted behavior. A passing lower-fidelity test does not close another boundary. Inventory implemented runners and inspect their paths before running them. Record unavailable, failed, skipped and unexecuted scenarios explicitly. Never relabel another runtime or database as PostgreSQL evidence.

## Test allocation principles

Choose evidence by the boundary under test. A fake verifies orchestration, never the production adapter. Rendering consumes models and callbacks without state initialization or effects.

## Layers and contracts

- Pure domain/data tests cover transitions, validation, lifecycle, containment, date/time resolution, rank, flags, perspective queries, projection, delta, persisted DTOs, cursors, Preview and Undo, with input nonmutation.
- Application tests inject store, clock and IDs. Cover operation ordering, replay before validation/allocation, fresh reads, conflict precedence, unknown outcomes and publication.
- Real PostgreSQL adapter tests cover atomic rollback, concurrent initial and subsequent writes, user revision CAS, changed rows, associations, identity markers, receipts and pruning. Shared fake contracts supplement these tests rather than replacing them.
- Node HTTP/MCP tests exercise the real server composition, protocol, authentication rejection, token/session verification, user binding, Origin/content-type and response serialization.
- UI model, DOM and communication tests cover dirty drafts, field baselines, IME, focus, keyed rows, gestures, local identities, acknowledgment, lost responses and exact-request recovery.
- Deployed tests exercise Cloud Run, Neon, actual identity provider and Web UI. Each external MCP client has its own discovery/resource/UI acceptance.

Dependency lint enforces pure/effect boundaries and shared readonly types using both allowed and forbidden fixtures. The combined runner must reject failed, canceled, skipped, unexecuted and TODO tests. Code changes require pnpm check and pnpm build; verify actual package scripts rather than assuming a new runner exists.

## PostgreSQL acceptance

Exercise consistent multi-query snapshots and change windows while another transaction writes. Verify first-write contention, stale revisions, identical replay, changed-input rejection, disconnects before/after commit, later corrections, Undo conflicts, user isolation, history retention and fenced pagination. Verify PostgreSQL driver integer, time and JSON mappings. Reads create no records. Commit order must agree with revisions and feed order.

Use isolated synthetic datasets and database instances. Never run destructive fixtures against personal or production data. Real deployed authentication cannot be established by synthetic identity headers or mock tokens.

## UI test responsibility map

Pure model tests own selection, proposals, conflict and recovery decisions. Application tests own serial mutation state and acknowledgment. DOM tests own focus/caret, node retention, events and layout-dependent effects. Communication tests own correlation, transport failure and host messages. Browser tests own rendering, pointer/touch, scrolling, resize and composition behavior. Actual host tests own resource caches, discovery, widget association and host lifecycle. A successful tool response does not establish rendered UI behavior.

## Performance and evidence

Use equivalent representative datasets and source/artifact identities across local Node/PostgreSQL and deployed direct HTTP/MCP measurements. Report raw samples, p50/p95, warm/cold behavior, payload sizes, DB wait and server/client timing boundaries. Browser rendering and host tool scheduling require separate measurements. Screenshots prove captured content, not earlier paint timing. Do not sum overlapping spans or infer SQL time from TTFB.

Each release records source, image digest, configuration, migrations, deployment revision, environment, commands, results and limitations. Separate correctness, latency and caller value: successful persistence does not prove a caller's management method or reduced cognitive burden. See [deployment](deployment.md) and [infrastructure](infrastructure.md).

## Infrastructure design acceptance matrix

The [requirements](../changes/change-20261018-cloud-run-neon-infrastructure/requirements.md) define EARS requirements and counterexamples; [verification](../changes/change-20261018-cloud-run-neon-infrastructure/verification.md) maps source facts, design self-review and unexecuted runtime acceptance. Include PostgreSQL text/code-unit round trips, lock-after-wait visibility, pooled-client RLS context reset, simultaneous duplicate-before-CAS replay, grant revocation and restored-timeline cursor invalidation. Test reauthentication with the proposal-owning UI still mounted and reject cross-account replay. No independent review or runtime test is implied by document validation.

## Implemented local runners

`pnpm check` runs ESLint, TypeScript and all selected test files, including `tests/postgres/`. The PostgreSQL fixture launches the packaged PostgreSQL 17 binaries in an isolated temporary cluster with a separate limited runtime role. It does not substitute SQLite or a handwritten fake. `pnpm test:postgres` selects these real-adapter, JWT/session HTTP/MCP and atomic-transfer suites. `tests/ui/web-session-relay.test.mjs` exercises the actual Web shell relay under DOM simulation, including retained iframe identity and exact arguments across reauthentication and account mismatch.

After `pnpm build`, `pnpm test:node:built` starts `dist/server/index.mjs` as a separate process and uses a real HTTP socket against the isolated PostgreSQL runtime role. It checks readiness, hashed assets, session/CSRF, a write and identical replay, and authenticated widget retrieval. Its synthetic pre-established session does not verify an external Auth0 authorization-code flow. Local RS256 tests use real signature verification and a synthetic JWKS; deployed JWKS discovery, provider settings, browser HTTPS login and individual MCP clients require separate acceptance.

Terraform formatting and validation establish configuration consistency, not resource creation, IAM effectiveness, capacity, provider compatibility, deployed latency or disaster recovery. The runbook names these remaining environment checks.
