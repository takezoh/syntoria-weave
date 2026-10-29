# Build a workflow with Syntoria Weave

Weave is a shared state store for the user and authorized AI consumers. Its actions, projects, tags and perspectives are available through data tools and a shared UI. Your LLM interprets the saved state and chooses how to capture, organize, review and change it. Start with a prompt and the existing tools; use a reusable skill when the same guidance is useful across requests.

## Find tools and schemas

| You need | Start here |
| --- | --- |
| Tools available in your connection | Your host's tool discovery, or MCP `initialize` followed by `tools/list` |
| Input JSON Schema | Each discovered tool's `inputSchema` |
| Kind-specific change fields and response shapes | [API/MCP contract](../technical/mcp-api.md#tool-and-schema-discovery) |
| Lifecycle, containment, dates and saved views | [Data model](../technical/data-model.md) |
| Help choosing capabilities and designing a workflow | [action-guide](../../skills/action-guide/SKILL.md) |
| Guidance for changing saved data and recovering uncertain writes | [action-tools](../../skills/action-tools/SKILL.md) |

Read tool descriptions alongside schemas: `apply_change` and `preview_change` specify Defer inputs conditionally on `kind=defer`, while other kinds retain generic payload objects, and the server does not advertise output schemas. The API reference explains the additional contract. When designing offline, use this checkout's reference; before execution, inspect the actual connected deployment and reconcile any difference. Do not infer a connection, authentication or successful operation from the presence of documentation.

## Connect and authorize access

Connect to the deployed HTTPS Remote MCP through the client's supported OAuth flow, or install the distributed local MCP plugin using the [installation guide](../technical/plugin-installation.md). The local server supplies the shared UI resource and forwards business operations to that same service through a private public-client OAuth connection. Backend deployment follows the [deployment workflow](../technical/deployment.md).

The service derives user identity from Gate-verified credentials. Tool discovery and UI metadata do not grant access to saved actions. A skill supplies guidance; it does not configure a connection. Keep endpoints, client configuration and private token state outside shared source and distributable templates.

`POST /api/actions` is the authenticated HTTP operation endpoint used by the SPA. Browser requests use the configured shared session, exact allowed origin and CSRF protection. MCP uses its own bearer authorization. Local synthetic authentication does not prove hosted login or actual client UI support. See the [entry-point contract](../technical/mcp-api.md#entry-points-and-ownership).

## Compose a workflow

Decide what should trigger the workflow, what information it may read, what changes are authorized and what the user should receive. Execution timing, external access and notifications belong to the caller's environment.

For example, a caller with authorized email access can collect requested commitments, read the current action snapshot, avoid duplicating saved actions and preserve exact source wording in notes through `capture_intent`. It can subsequently organize those actions with `apply_change` when the user's intent is clear. Scheduling that collection requires a scheduler in the caller's environment; no Weave email connector or background worker is needed.

For a review, query saved actions or a perspective, then present relevant candidates and reasons. A recommendation does not itself complete, defer or flag an action. A recurring extraction can be saved as a filter-only perspective; a temporary query need not create a saved view.

For writes, read the current user-wide revision and keep the exact tool name, operation ID and full arguments. A timeout means the result is unknown: look up the receipt or resend the identical request. An explicit revision conflict requires rereading and reconciling the proposal. Undo may refuse later target corrections, and receipt history is kept for 30 days per user, at least the latest 100 and at most the latest 5000 operations. See [recovery](../technical/mcp-api.md#responses-and-recovery) before automating retries.

These examples are workflow designs, not installed schedules or evidence that a particular host has external access.

## Continue from shared state

If the user corrects an action in the UI or another authorized conversation saves a result, read the current state before continuing. `list_actions` and `get_relevant_context` return the complete user snapshot and revision. Compare that state with the current request and any retained context, use original notes or authorized source tools where needed, and revise the proposal before saving. A shared store makes the saved correction available without requiring the user to repeat it in every conversation; it does not update an AI's conversational context automatically.

Each conversation or workflow may have read a different version. Use the current revision for writes and the existing conflict/recovery contract. Recover any context that was not saved through the caller's own environment. Completing a read does not complete an Action or mark information as read by the human.

For incremental reads, bootstrap from a complete `list_actions` snapshot and retain its `change_cursor` with the consumer's own context. Call `get_changes` with that cursor, apply each complete operation page, and save `next_cursor` only after the page is applied. A split page is fenced to the observed head; continue until `has_more` is false. Empty and terminal pages provide a live cursor for later writes. On `cursor_expired`, replace the local cache from a fresh full snapshot and its cursor. A cursor is not a server checkpoint or evidence that a human read or acted on changes. See the [incremental API contract](../technical/mcp-api.md#current-reads-and-incremental-changes).

Keep the last successfully processed cursor when retrieval or processing fails. A repeated page may contain operations already applied to the local cache: use their stable operation identities/revisions and before/after values to avoid duplicate processing. Save the replacement position only after processing and the caller's intended output succeed. Each conversation or workflow owns its own context/cache/checkpoint; advancing one does not move another. For writes whose responses are missing, retain the exact operation ID and arguments and follow the separate receipt/replay contract above.

An empty feed says only that no retained persisted changes followed that position. Time-based Defer visibility, an approaching deadline and external circumstances may still require reconsideration or a current read. If the cache or conversational context is lost, obtain necessary current state even when the feed is empty. A full snapshot can restore saved state, but neither it nor a cursor recovers preferences, prior proposals or agreements that were never saved. Fetch related context when a small change has wider implications; the changed fields do not define the whole reasoning scope. The [local synthetic observations](../evidence/20261014-cursor-caller-value.md) demonstrate these distinctions with actual callers and report parity with full-state comparison, without a universal model or long-term benefit claim.

## Use the optional skills

| Skill | Purpose |
| --- | --- |
| `action-guide` | Answer capability questions, explain state and sketch caller workflows with their required host capabilities |
| `action-tools` | Execute authorized saved-list operations with revision, replay and Undo handling |

Neither skill is required by the server. Tool discovery and caller-facing initialize/snapshot guidance remain available without them. A skill is useful when an assistant needs reusable instructions beyond the tool's input fields. The guide is advisory: loading it does not authorize writes. Choose the operation skill for an actual saved-list request.

The folders under `skills/` are distribution sources, not proof that a host has installed them. Copy the complete selected folder, including `references/`, into your host's supported skill location. Current official documentation lists `.agents/skills/` in a project or `~/.agents/skills/` for Codex, and `.claude/skills/` in a project or `~/.claude/skills/` for local Claude Code. Follow your environment's policy and verify discovery after installation. These locations come from the [Codex skill guide](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills) and [Claude Code skill guide](https://code.claude.com/docs/en/skills#where-skills-live).

Installing a local skill does not connect the MCP server, establish authenticated access, install it in ChatGPT or configure a scheduler. The skills use generic identifiers; Syntoria Weave is the product and host listing name.

## Skill or subagent?

Use a skill to supply reusable product knowledge and workflow guidance in the caller's existing conversation. A separate subagent can help when repeated documentation research needs an isolated context or a restricted tool set; its configuration belongs to the caller's host. The supplied guide uses the portable `SKILL.md` format and does not require a subagent runtime.

The official [OpenAI skill guide](https://learn.chatgpt.com/docs/build-skills) describes loading detailed references when needed. Claude Code's built-in `claude-code-guide` illustrates a dedicated assistant for product questions; its [subagent documentation](https://code.claude.com/docs/en/sub-agents#built-in-subagents) explains isolated contexts and tool restrictions. These are design references, not evidence that Weave is connected or verified in either host.
