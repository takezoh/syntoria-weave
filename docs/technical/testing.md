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

Pure model tests own selection, proposals, conflict and recovery decisions. Application tests own serial mutation state and acknowledgment. DOM tests own focus/caret, node retention, events and layout-dependent effects. Communication tests own correlation, transport failure and host messages. Browser tests own rendering, pointer/touch, scrolling, resize and composition behavior. Actual host tests own resource caches, discovery, widget association and host lifecycle. A successful tool response does not establish rendered UI behavior. `tests/ui/autosave.test.mjs` verifies one `apply_change` for ordinary completion and `status: completed`, descendant baseline updates from committed `changedIds`, retained child drafts and warnings, known CAS retry and exact unknown-result replay. `tests/ui/model.test.mjs` verifies completion feedback as a nonmutating projection of the receipt and committed snapshot.

## Performance and evidence

Use equivalent representative datasets and source/artifact identities across local Node/PostgreSQL and deployed direct HTTP/MCP measurements. Report raw samples, p50/p95, warm/cold behavior, payload sizes, DB wait and server/client timing boundaries. Browser rendering and host tool scheduling require separate measurements. Screenshots prove captured content, not earlier paint timing. Do not sum overlapping spans or infer SQL time from TTFB.

Each release records source, image digest, configuration, migrations, deployment revision, environment, commands, results and limitations. Separate correctness, latency and caller value: successful persistence does not prove a caller's management method or reduced cognitive burden. See [deployment](deployment.md) and [infrastructure](infrastructure.md).

## Infrastructure design acceptance matrix

The [requirements](../changes/change-20261018-cloud-run-neon-infrastructure/requirements.md) define EARS requirements and counterexamples; [verification](../changes/change-20261018-cloud-run-neon-infrastructure/verification.md) maps source facts, design self-review and unexecuted runtime acceptance. Include PostgreSQL text/code-unit round trips, lock-after-wait visibility, pooled-client RLS context reset, simultaneous duplicate-before-CAS replay, grant revocation and restored-timeline cursor invalidation. Test reauthentication with the proposal-owning UI still mounted and reject cross-account replay. No independent review or runtime test is implied by document validation.

## Implemented local runners

`pnpm check` runs ESLint, TypeScript and all selected test files, including `tests/postgres/`. The PostgreSQL fixture launches the packaged PostgreSQL 17 binaries in an isolated temporary cluster with a separate limited runtime role. It does not substitute SQLite or a handwritten fake. `pnpm test:postgres` selects real-adapter HTTP/MCP and atomic-transfer suites; the ordinary Gate fixture supplies synthetic online browser-session and bearer responses. `tests/ui/web-session-relay.test.mjs` exercises the actual static SPA relay under DOM simulation, including retained iframe identity and exact arguments across reauthentication and account mismatch.

`pnpm dev` starts the same shared widget UI and action HTTP/application/PostgreSQL paths on `http://localhost:5174`, with a separate temporary PostgreSQL 17 cluster and synthetic identity created at startup. It serves only the local shell, built widget and API routes; deployment runtime settings are not read or served. The loopback launcher checks Host, Origin, JSON content type and CSRF for writes. Shutting it down removes the database directory. This is an interactive local development preview, not evidence for Gate authentication or hosted Cloud Run/Neon behavior.

After `pnpm build`, `pnpm test:node:built` starts `dist/server/index.mjs` as a separate process and uses real HTTP sockets against the isolated PostgreSQL runtime role. It confirms the API-only route surface, then checks a synthetic Gate HTTPS fixture through the built SDK: shared-cookie session/CSRF, exact credentialed CORS, raw duplicate-header rejection, a write and identical replay, MCP bearer access, revocation and outage behavior. It does not serve SPA assets or verify GitHub login. The synthetic Gate fixture does not replace the actual Gate/Firestore integration below.

Terraform formatting and validation establish configuration consistency, not resource creation, IAM effectiveness, capacity, provider compatibility, deployed latency or disaster recovery. The runbook names these remaining environment checks.

## Actual Gate integration

Build the sibling Gate checkout and start a loopback Firestore Emulator for project `demo-gate-test`, database `(default)`. Run `FIRESTORE_EMULATOR_HOST=127.0.0.1:55435 GATE_TEST_ROOT=../syntoria-gate node --import ./scripts/testing/register-loader.mjs scripts/testing/verify-gate-integration.mjs`. This explicit harness is separate from ordinary tests, which do not require the sibling checkout or emulator. No sibling dependency is present in production artifacts.

The harness uses the actual Gate `oidc-provider` service and Firestore storage, an isolated trusted HTTPS issuer, the actual Gate SDK and real PostgreSQL over Weave's HTTP socket. Only GitHub's external identity exchange is injected at the test port. It follows explicit browser approval, shared-session reuse by a second registered SPA, validation against a second resource, direct cookie API/CORS/CSRF, raw duplicate-header rejection, write/replay/Undo/replay after correction, Gate outage/logout, and a dynamically registered and independently approved MCP authorization-code PKCE connection, refresh, subject admission and connection revocation. It verifies that Weave stores no browser sessions. A passing run proves these local protocol/storage boundaries; actual GitHub login, static SPA host acceptance, hosted Cloud Run/Firestore/Neon and individual MCP clients remain separate.

## Local MCP consumer and ChatGPT cloud package

`tests/mcp/local.test.mjs` exercises DCR public-client OAuth through the maintained OIDC client library, private registration reuse, exact issuer/resource metadata, S256 callback state, callback port errors, redirect rejection, private credential storage, process concurrency, lifecycle generation and remote result/error forwarding. `tests/postgres/local-consumer.test.mjs` runs `scripts/testing/verify-local-consumer.mjs` through the ordinary combined test runner. It forwards business calls over real Node HTTP/MCP and the real PostgreSQL adapter, including write/replay/Undo and user isolation; the OAuth service is synthetic.

`tests/mcp/cloud-plugin.test.mjs` exercises the manifest validators, renderer CLI and personal package builder CLI in a temporary fixture. It checks that the generic artifact has a template app ID and no installable marketplace entry, configured settings require a host-shaped app ID, the configured marketplace resolves `./syntoria-weave`, `.app.json` requires the exact dependency, `mcpServers` stays empty, both operation skills and the license ship, inventory hashes match, the shared UI bytes match, and stale executable or tampered files are rejected. `pnpm build` runs the artifact verifier against `dist/plugin`; `pnpm verify:plugin` can run it separately. These checks do not establish ChatGPT registration, package installation, authentication, tool refresh, new-chat resource caching, rendered UI or selection behavior. ChatGPT acceptance requires a browser/cloud session with the Desktop app and local MCP stopped, including selected Action A/B changes and explicit-selection clearing through `get_selection_context`.

Local authorization state uses Node's SQLite support in an explicitly configured private directory. This storage contains only the consumer's OAuth state; it is not a business-data database or a backend-selection mechanism. Transaction tests establish cross-process serialization and generation protection; D1 tests separately establish the retained standalone adapter contract. Production business persistence remains PostgreSQL.
