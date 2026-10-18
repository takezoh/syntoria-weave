# Development and acceptance guide

## Infrastructure

Weave is an independent Cloud Run/Neon service exposing HTTP API and MCP. Follow [infrastructure design](technical/infrastructure.md). Backend releases and client acceptance are verified separately. Confirm command behavior from package.json and code; a design decision does not prove implementation.

[README](../README.md) and [PRODUCT](../PRODUCT.md) describe the product. [Architecture](../ARCHITECTURE.md) describes current responsibilities and implementation. Development instructions belong here and in technical references.

## Product and caller boundary

Syntoria Weave is Syntoria's State Store for the user and authorized AI consumers, exposed through API/MCP operations and a shared UI. Actions, projects, tags and perspectives are its current structured model for everyday work and personal state. User prompts, the caller-side LLM and caller-side schedulers choose the management method and execution timing. GTD is one possible use. External collection, Slack/email access, observation and notifications belong to the caller; composing its tools with Weave does not require a dedicated plugin integration. Preserve flexible operations and stable data guarantees when changing the service.

The intended benefit is less total remembering and management work, with more attention for action and rest. Service correctness, caller workflow quality and user outcomes require separate evidence. Product text must stay within the claim boundaries in product design. See [product design](design/product.md) and [caller responsibilities](design/assistance.md).

## Current contract and references

Actions have containment, sibling order and direct boolean flags. Independent prerequisite edges and parallel/sequential execution constraints are unsupported. Writes use schemaVersion 2 without compatibility aliases or runtime data fallback.

| Reference | Purpose |
| --- | --- |
| [Data model](technical/data-model.md) | Durable state, order, flags, lifecycle and atomicity |
| [MCP/API](technical/mcp-api.md) | Current tools, payloads, responses and recovery |
| [Caller workflow guide](usage/agent-workflows.md) | Tool/schema discovery, optional guide/operation skills and caller composition |
| [Testing](technical/testing.md) | Effect boundaries, suites and validation limits |
| [UI architecture](technical/ui-architecture.md) | UI source tree, dependency direction and static enforcement |
| [Deployment](technical/deployment.md) | Local/hosted environments and release procedure |
| [Product design](design/product.md) | Product positioning, audience, claim boundaries and hypotheses |
| [Assistance design](design/assistance.md) | Host/application responsibility split |
| [State design](design/design-action-state-and-perspectives.md) | Current state contract |

Current facts must be checked in code and the technical references above. Documents outside docs/*/** describe only the current state. Historical records and change rationale belong under docs/*/**.

Current full-state reads return a complete user snapshot, matching change cursor and revision. `get_changes` pages retained operation deltas under that revision, receipt and user boundary. Keep interpretation and follow-up decisions in the consuming LLM; the feed does not add per-consumer storage, claim a user read a change, or change write/replay semantics. The historical design discussion remains in [product design](design/product.md#change-cursor-api-and-adoption-history); current behavior is defined by the [API contract](technical/mcp-api.md#current-reads-and-incremental-changes).

## Responsibility and verification principles

For every change, choose the smallest correction that is sound in responsibility, boundary and structure. Identify the cause and the responsibility that owns it before editing; assess the affected contracts and dependency direction. Do not stop at a local symptom patch when it leaves misplaced responsibility, duplicated logic or a boundary violation in place. Minimality means the least change that fully restores the correct structure and behavior, not the fewest changed lines or files. Change internal APIs or file layout when necessary, while keeping unrelated refactoring outside the scope.

Structure code by responsibility and dependency direction. `lib/data/types.ts` is the type-only source of shared readonly contracts. Pure request normalization and explicit-ID finalization, along with storage row codecs, receipt parsing, changed-row plans and budgets, live in `lib/data/model/`; they have no user, database or ID-generation capability. Domain transitions consume readonly snapshots and return cloned state. Application code coordinates transitions and ports, and owns clock and ID allocation. Keep concrete DB, DOM, HTTP and host communication in adapters, connected at composition roots.

For UI changes, follow the [UI architecture principles](technical/ui-architecture.md#development-principles). Share list/detail components through explicit readonly view data and callbacks. Normalize state before publication, never as a consequence of rendering. Reuse model-owned data types instead of declaring parallel component schemas, and preserve unsaved input and exact unknown-request recovery across refreshes.

Treat the file tree and lint rules as part of the contract. New modules must belong to a declared layer; dependency changes require corresponding architecture documentation and positive/negative tests against the actual ESLint configuration. The data layer guards type-only shared contracts and every applicable import form across JS/TS extensions, including aliases, re-exports, inline type imports, import-equals and dynamic or nonliteral imports. Do not bypass a boundary with an alias, re-export, type import or suppression.

Assign each assertion to the narrowest boundary that can establish it, following the [test allocation principles](technical/testing.md#test-allocation-principles). Pure tests cover data decisions, fake-port tests cover orchestration, and real adapter/DOM tests cover effects. Rationalization means removing demonstrated duplication while preserving distinct integration guarantees, not reducing the test count or substituting mocks for required real-boundary evidence.

## Local development

Use Node.js 24 LTS and the packageManager version in package.json. Install with pnpm install --frozen-lockfile. Do not update dependencies or regenerate the lockfile without a relevant requirement.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm test:postgres
pnpm test:node:built
```

Set the validated environment contract in [deployment](technical/deployment.md) before `pnpm start` or `pnpm dev`. Administrative commands require an explicit `ADMIN_DATABASE_URL`; `LOCAL_DATABASE=true` permits nonproduction loopback PostgreSQL without TLS. Browser sessions require an HTTPS canonical origin and a registered identity provider.

Confirm actual runtime and command behavior in package.json and source before verification. build/ contains source and must not be deleted as generated output. Container artifacts, dependencies and local/auth settings must not enter source changes.

## Acceptance and release

For code changes run check and build. Store changes require atomic failure, CAS, replay, unknown-response recovery, Undo and user-isolation tests. UI changes require dirty-proposal retention and exact-request recovery. Documentation-only changes require content/link checks, not claims of app acceptance.

Before behavioral verification or delegation, follow [environment and harness selection](technical/testing.md#environment-and-harness-selection). Use the existing environment that exercises the requested boundary; supplemental mocks do not replace that acceptance.

Use Cloud Run, Neon PostgreSQL, verified OAuth/session identity and declarative infrastructure. Preserve source data and access restrictions during deployment and cutover. Local migrations do not establish hosted deployment.

A release must associate source commit, artifact, version/deployment, timestamp, access scope and actual host results. Hosted cache, tools and UI resources must be checked after any relevant deployment.

The host skill file is documentation until actually installed/delivered. Weave does not itself run notifications, calendar sync, external observation or background execution. A user may arrange these in a caller workflow; validation of that workflow belongs to its own execution environment.
