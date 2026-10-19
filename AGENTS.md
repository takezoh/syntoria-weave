# Syntoria Weave development guidance

This file defines repository-specific responsibilities, workflow and validation requirements. Respond in Japanese unless requested otherwise. Write new or edited documentation and code comments in English.

## Read first

- README.md is the user-facing product introduction, not the place for development instructions.
- docs/development.md is the development, acceptance and design entry point.
- ARCHITECTURE.md describes the current runtime, responsibilities and invariants.
- Read relevant docs/technical/data-model.md, mcp-api.md and deployment.md.
- For product changes read docs/design/product.md, assistance.md and design-action-state-and-perspectives.md and the applicable change package; distinguish historical decisions and acceptance from the current action contract.

Confirm implementation facts in code. The architecture is Cloud Run with Neon PostgreSQL; see docs/technical/infrastructure.md. Deployment and acceptance evidence must match the source version being evaluated.

## Product and boundaries

Weave is Syntoria's State Store, through which caller-side AI/LLM consumers share state with the user and other authorized AI consumers. Its current model represents everyday work and personal actions, projects, tags and perspectives, accessible through API/MCP and the dedicated UI. Its purpose is to let users delegate upkeep, preserve corrections across interactions, reduce remembering and organizational burden, and make room for action, decisions and rest. Sharing remains within the authenticated user's boundary; each consumer must read current state and interpret it in its own context.

Meaning, organization, recommendations and management method belong to the user and caller-side LLM. A consumer AI is a caller, not a Weave-owned component. User prompts and caller-side schedulers decide when and how to use the published shared-state API/MCP tools. GTD and other management methods are caller choices. Authorized callers may collect Slack/email inputs through their own tools and save them in Weave without dedicated plugin integrations. Do not add an independent recommendation LLM or GTD engine. Weave owns persistence, input validation, transitions, containment/date integrity, revision, replay, Undo and ownership boundaries. Preserve ambiguous input as original text without invented deadlines or commitments.

The entity is action, not task. Relationships are parent-child containment only. Action order expresses intended sequence without restricting execution or visibility. Do not add prerequisite edges or sequential/parallel modes. Flagged is direct boolean state only; inheritance is a possible future feature, not the current contract.

Calendar sync, proactive notifications, background jobs and external-condition observation are caller responsibilities, not Weave services. Do not treat their absence in the plugin as a prohibition on caller workflows or require specialized Weave integrations for tool composition. Saved perspectives are supported filter-only data definitions; dedicated perspective UI controls remain outside current scope.

## Pure logic and effects

Follow the enduring [responsibility and verification principles](docs/development.md#responsibility-and-verification-principles), [UI architecture principles](docs/technical/ui-architecture.md#development-principles), and [test allocation principles](docs/technical/testing.md#test-allocation-principles). Keep the physical layers and lint fixtures aligned when adding modules. Components consume model-derived readonly data and explicit callbacks; rendering must not initialize or mutate application state.

For every change, identify the cause and its owning responsibility, then make the smallest correction that is sound in responsibility, boundary and structure. Do not leave structural defects behind with a local symptom patch. Minimize the change needed to restore correct structure and behavior, not the number of edited lines or files; include necessary internal API or file-layout changes and exclude unrelated refactoring.

Implement transitions, validation, projection and UI state decisions as pure functions: deterministic results and no input mutation. DB, DOM, host communication, HTTP, clock and IDs are effects behind ports/adapters. Inject them at entry points; pure logic must not depend on concrete runtime implementations.

Separate pure unit tests, application tests with mock/fake ports, real adapter tests for atomicity/CAS/user isolation, and UI state/DOM/communication tests. A passing fake does not prove the real adapter; use shared contracts and integration tests. State actual-host-only limitations explicitly.

Lint dependency direction and effect leakage. The combined harness must report failures and unexecuted/skipped tests. Fix structural responsibility defects even when that requires internal API or file-layout changes. Disclose destructive external-contract/data changes and their migration.

## Runtime and source locations

Cloud Run/Neon responsibilities are defined in docs/technical/infrastructure.md. Verify implementation facts from code. Backend infrastructure exposes standard HTTP and MCP interfaces.

TypeScript/Node.js runs on Cloud Run with Neon PostgreSQL. HTTP API, Remote MCP and the Web UI share the application and user-bound PostgreSQL adapter.

| Location | Responsibility |
| --- | --- |
| lib/domain/ | Pure action transitions, containment, dates, order, flags, delta, preview and Undo |
| lib/application/, lib/adapters/, lib/server/ | ActionStore ports, operation progress, PostgreSQL/Node effects and production composition |
| lib/mcp/dispatcher.ts, lib/server/node/server.ts | Remote JSON-RPC, tool discovery, UI resources and authenticated HTTP entry |
| lib/mcp/local/ | Standalone public-client OAuth consumer and private local authorization state |
| plugins/action-tools/ | ChatGPT cloud plugin metadata and remote MCP manifest template |
| lib/server/node/authentication.ts, principal.ts | Verified OAuth/session identity, CSRF and request capability |
| lib/ui/, lib/widget.ts | Pure model, typed controller, DOM/communication adapters and HTML composition |
| lib/assistance.ts | Assistance-policy delivery; check initialize and snapshot assistance_policy |
| web/ | Shared-UI shell, session recovery and HTTP relay |
| lib/adapters/postgres/, db/schema.ts, db/postgres/migrations/ | PostgreSQL pool, transactions, identity and schema |
| scripts/, build/ | Node, SPA, standalone local MCP and cloud-plugin build/verification helpers; build contains source |
| skills/action-tools/SKILL.md | Assistance documentation, not proof of host installation |

Source code, tests, scripts, configuration, MCP tool names, UI resource URIs and the Skill use generic identifiers such as action-tools and list_actions and never contain the product name. The ChatGPT plugin identity is syntoria-weave and its display name is Syntoria Weave; its package manifest is host-listing metadata. Other source identifiers remain generic. Applied SQL migrations keep their recorded identifiers.

Conversation and Web preview share actionCall/core/store paths. Do not connect UI directly to the database or implement alternate transitions per entry. Follow existing naming/style and avoid unrelated formatting.

## Contracts to preserve

- C1: parent Defer affects descendants' visibility without overwriting their own dates.
- C2: parent completion atomically completes all descendants; child completion never automatically completes a parent.
- C3: date-only Defer resolves the explicit client timezone's 09:00 to UTC; saved instants do not move with timezone changes.
- C4: explicit on-hold remains unfinished and in normal view unless deferred.
- Expiry appears on the next read without rewriting saved values or reopening completed actions.
- Withdrawal retains dropped records, restorable by status edits or applicable Undo.
- Order and direct Flag changes preserve lifecycle/dates and use ordinary revision, receipt and Undo guarantees.
- Writes use schemaVersion 2, an operation ID and latest user-wide revision. Preview does not reserve state.
- Identical replay uses the receipt; different input is rejected and later corrections are never rolled back by replay.
- Conditional latest-revision validation, changed action/catalog/association rows, identity markers, receipt and history pruning share one atomic PostgreSQL transaction. Do not use owner_state or full-delete/full-save storage.
- Missing responses are unknown outcomes. Retain exact IDs/arguments for lookup/replay; do not create duplicate writes with fresh IDs.
- Refresh/host notifications preserve unsaved proposals. Revision/Undo conflicts must not erase later corrections without consent.
- Verified OAuth/session identity determines user. Public identity headers are untrusted. Never accept user from arguments; user-scope SQL and receipts.
- Unfinished is active/on-hold. Inbox is project-unassigned unfinished actions, independent of title or an organization flag.
- New original input is an ordinary action with caller-supplied title and exact raw notes. Do not automatically create tags.
- A person finishing their work and a delegated process finishing its run are separate records. Action lifecycle reflects the person's decision; keep execution progress outside it.

## Development and checks

Use Node.js 24 LTS and package.json's pnpm version. Install with pnpm install --frozen-lockfile; avoid unrelated dependency or lockfile updates.

| Command | Purpose |
| --- | --- |
| pnpm dev | Local portable preview on port 5173 |
| pnpm check | lint, typecheck, all suites; no failure/unexecuted/skip/TODO passes |
| pnpm test | All domain, application, adapter, UI and harness suites |
| pnpm test:storage | Supplemental memory/SQLite contracts and SQL regressions |
| pnpm test:postgres | Real PostgreSQL 17 adapter, authentication, HTTP/MCP and transfer |
| pnpm test:ui | Pure models, mock ports, host communication and generated HTML DOM |
| pnpm test:node:built | Built Node process, real PostgreSQL, HTTP, sessions, replay and UI resource |
| pnpm typecheck / lint | TypeScript / ESLint |
| pnpm build | Build the Node service, static SPA, standalone local MCP bundle and noninstallable ChatGPT package template |
| pnpm build:plugin | Generate the personal marketplace root; explicit --config requires rendered public settings and the host-issued app ID |
| pnpm db:generate | Generate migrations; inspect SQL |
| pnpm db:migrate:local | Migrate explicit ADMIN_DATABASE_URL; build first |
| pnpm start | Start the built service; confirm the actual runtime |

The checkout builds the Node service, static SPA, standalone local MCP consumer and Syntoria Weave personal package directly. `pnpm build` emits a noninstallable template without a marketplace entry. `pnpm render:plugin-config` writes ignored deployment settings, including the actual `plugin_asdk_app…` ID returned by ChatGPT; `pnpm build:plugin --config .local/dist/action-tools/plugin-settings.json` emits the private install root. The package requires that registered app through `.app.json` and keeps `mcp.json` empty. It contains both operation skills, the shared UI and `LICENSE`. Use `pnpm render:local-mcp-config` for the separate local consumer, which is an OAuth consumer of Remote MCP and has no database or resource-client credentials.

Code changes require pnpm check and pnpm build. Store changes must verify competition, identical replay, missing responses, Undo and user isolation. UI changes must verify proposal retention and unknown-result recovery. Documentation-only changes require content/reference checks; do not claim app acceptance.

Mock auth and local database tests do not prove hosted PostgreSQL, trusted authentication or client-host UI acceptance. Host resources require actual host retrieval/cache checks when deployed.

Before behavioral verification, inventory actual harnesses in docs/technical/testing.md and confirm their implementation. MCP-to-storage verification must exercise Node HTTP/MCP and the real PostgreSQL adapter. Distinguish local PostgreSQL from hosted Neon. Mocks or another database cannot close that boundary. Record concrete failures and unexecuted tests; host-specific behavior requires actual host acceptance.

## Documents, data and deployment

User material belongs in README.md/PRODUCT.md; development instructions in docs/development.md/docs/technical/. Documents outside docs/*/** must describe only the current state, without past states or change rationale. Place historical records and change rationale under docs/*/**. Use dev:dev-docs and docs/.docs-config.yaml for change/design/ADR/note/issue documents.

Preserve deployed resource identities, data and access scope during cutover. Use declarative infrastructure and versioned PostgreSQL migrations. Plugin installation is independent of infrastructure creation.

The action API uses schemaVersion 2 without compatibility aliases or runtime data fallback. Preserve SQL migration files and infrastructure. Remote data reset requires explicit authorization and a requested deployment workflow; local migration is not hosted reset.

A release must associate source commit, artifact, version/deployment and host results; follow docs/technical/deployment.md.

Do not include dist/, .next/, .vinext/, .wrangler/, .sites-runtime/, dependencies, local settings or credentials as artifacts. Keep bundled licenses when editing vendor distributions. Never indiscriminately log action text, personal information or credentials.
