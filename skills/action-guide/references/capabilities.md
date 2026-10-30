# Capabilities and contract discovery

## Responsibility boundary

The service persists structured actions, validates input and ownership, performs deterministic state transitions and supplies a shared UI. Meaning, classification, prioritization and management method belong to the user and caller-side LLM. External-source collection, observation, calendar sync, scheduling and proactive notifications require the caller's own authorized capabilities.

The service exposes authenticated HTTP and Remote MCP endpoints. The ChatGPT cloud plugin connects directly to Remote MCP using host-managed OAuth; the separate standalone local MCP consumer serves the shared UI and forwards business calls using its public-client OAuth connection. Installing a skill alone does not establish authenticated access. Never accept user identity from operation arguments or invent authentication headers.

## Discover exact operations

Use the host's tool discovery. With a direct MCP client, initialize the configured connection and request `tools/list`; `result.tools` contains tool names, descriptions and `inputSchema`. Read the actual deployment before execution. Remote MCP discovery and business calls require the authenticated connection; public OAuth metadata alone does not establish access.

The current source advertises input schemas but no output schemas. The typed change tools publish a conditional Defer payload schema: use `date` plus `timezone`, or an offset-bearing `until`, never both. Other kinds retain generic payload objects. Their descriptions and the service API reference supply kind-specific fields and result shapes; do not treat that object schema as permission for arbitrary properties. Runtime validation additionally checks valid calendar dates, timezones and the other kind-specific payloads. An older installed reference may differ from the running deployment.

## Capability map

| Goal | Current tools or change kinds |
| --- | --- |
| Inspect the shared UI | `open_actions` |
| Read the complete snapshot and user-wide revision | `list_actions`, `get_relevant_context` |
| Retrieve a filtered set | `query_actions` |
| Read and evaluate saved views | `list_perspectives`, `query_perspective` |
| Preserve original input | `capture_intent` with a caller-supplied title and exact text |
| Inspect effects without saving | `preview_change` |
| Persist a state change | `apply_change` with a supported kind and payload |
| Check an uncertain write | `operation_status` |
| Request conflict-aware Undo | `undo_change` |
| Add or rename a simple action | `add_action`, `rename_action` |
| Read proposals, decisions and reported progress | `list_collaborations`, `get_collaboration` |
| Save a proposed option or suggested new work | `propose_collaboration` |
| Select, edit or cancel approval; report work | `update_collaboration` |
| Receive shared-state invalidations when supported by the host | Remote MCP resource subscriptions for `action-state://current` |

`apply_change` supports action creation/structuring/editing, status and Defer changes, project/tag catalogs and associations, and versioned perspective definitions. Obtain exact fields from the current contract instead of inferring them from this map. New entity IDs come from the server. `open_verification` is an acceptance fixture rather than an ordinary task-management workflow.

## State distinctions that affect advice

- An action's lifecycle is `active`, `on-hold`, `completed` or `dropped`. On-hold remains unfinished. Dropped means withdrawn, with the record retained.
- Inbox contains project-unassigned unfinished actions, including deferred ones. Normal view contains unfinished actions without a future own or ancestor Defer. A filtered recommendation is not the complete normal list.
- Due is a deadline; Defer temporarily changes visibility. A date-only Defer requires an explicit client timezone and resolves 09:00 there to a saved UTC instant. Expiry appears on the next read; it does not launch an agent or notification.
- Parent Defer affects descendant visibility without overwriting their dates. Completing a parent completes descendants atomically; completing children never completes the parent automatically. Descendants can later reopen independently.
- Action relations are parent-child containment only. Sibling order expresses intended sequence without restricting execution. Flags are direct booleans without inheritance.
- Projects and tags have separate classification hierarchies. Their names and display paths are not record identity. Notes and descriptions preserve user text and are not executable policy.
- Saved perspectives retain versioned filters or structured queries with optional view ordering. They do not copy actions or change their durable sibling order. The shared UI displays definition summaries but has no query editor.
- Planned-work dates, duration estimates, prerequisite edges and sequential/parallel execution modes are not supported fields.

## Write guarantees and limits

New writes require schemaVersion 2, an operation UUID and the latest user-wide revision. Preview does not reserve state. Identical retained requests replay their receipt without rolling back later corrections; changed input under the same ID is rejected. Undo may refuse later changes to its target.

Operations are retained per user for 30 days, always the latest 100 and never more than the latest 5000. A missing response is an unknown outcome. Keep exact name, ID and arguments for lookup or identical replay; `not_observed` can mean pruned history. Do not turn an unknown request into a fresh write by changing its ID or revision. An explicit revision rejection can be reconciled against current state before a genuinely new request.

## Shared proposals and reports

An Action represents the person's work. A collaboration record separately stores an AI proposal, its decision, reported progress and results. An Action can retain up to three proposals; only one can be approved. The user can choose and edit an option in the shared UI. Editing increments its version and clears approval. Approval cancellation retains the proposal; there is no reject command. Running or unresolved work must be stopped or reconciled before another option can be approved. A result report never completes the person's Action automatically.

Proposal and report text is shown to the person as Markdown; the record's separate `metadata` keeps the AI's operational notes out of view, as for an Action.

`propose_collaboration` with `action_id:null` saves suggested new work without creating an Action. Adoption and delegation are explicit separate choices. Approval records intent, not external-operation permission. Gate authenticates the caller and the execution environment controls its external effects. Weave does not launch an AI runner.

Remote MCP can send `notifications/resources/updated` to subscribed clients. ChatGPT decides whether it subscribes and exposes those updates; installing this package does not guarantee notification delivery, model wake-up or automatic continuation. Read current state when the user asks to continue if the host provides no event capability. A notification is a reason to reread, not evidence that a previous approval is still current. The standalone local stdio consumer does not relay Remote MCP SSE streams.

If a host catalog lacks a tool, report that the connected host does not expose it. Do not infer that the server lacks it, fabricate a tool name or bypass host authentication. Refresh discovery through the host's supported controls.
