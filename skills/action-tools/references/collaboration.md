# Proposal operations and notifications

Use the connected deployment's schemas. These tools share the authenticated user's revision and state with ordinary Action operations. Never pass user identity in arguments. If the host does not expose a tool, refresh supported discovery or explain that host limitation; a stale catalog does not prove server absence.

## Read and propose

`list_collaborations({})` returns the complete snapshot with collaboration heads. `get_collaboration({id})` also returns up to 50 history entries; pass `next_before_revision` as `beforeRevision` for older history. Read before writing and retain unsaved edits across refresh or conflict.

`propose_collaboration` requires `schemaVersion:2`, a fresh UUID `operationId`, the latest `expectedRevision`, `action_id` and `proposal`. The complete proposal contains `title`, exact original `instructions`, `scope`, expected `outcome`, `exclusions` and `source`. Use an existing Action ID for assistance on human work; use null for suggested new work that is not yet an Action. Set `request:true` only for an explicit request against an existing unfinished Action, not for unsolicited suggestions.

Each linked Action retains at most three proposal heads, including old withdrawn/rejected records. Save options sequentially using the revision returned by the preceding confirmed write. Do not create a fourth or delete an option to evade the limit. Revise an existing option only within the user's requested changes and preserve later corrections.

## Select, edit and cancel approval

`update_collaboration` requires `schemaVersion:2`, `operationId`, `expectedRevision`, the collaboration `id`, `command` and `payload.version` from the current record.

| User intent | Command and additional input | Result |
| --- | --- | --- |
| Approve this option | `accept` | Selects one proposal; does not start a process |
| Edit an option | `revise`, with complete `payload.proposal` | Increments version and clears approval; running or unknown work must be resolved first |
| Cancel approval | `withdraw` | Keeps the proposal pending; running work can receive a stop request |
| Ask for changes | `request_changes`, with `payload.feedback` | Records feedback for revision |
| Adopt suggested new work | `adopt`, with top-level `action_id:null` or an existing ID, and explicit `delegate` | Creates or links an Action; delegation is a separate choice |

There is no `reject` command and no need to reject an unapproved option. Cancellation does not delete the proposal and does not confirm an external process stopped. Only one proposal can be approved per Action. Running, stop-requested or unknown work blocks switching to another option until resolved. Use dedicated collaboration transitions rather than `undo_change` for decisions.

## Execute and report

Approval is business intent, not external permission or proof of a human click. Read current Action and proposal state before starting, and obtain permissions from the actual execution environment. `start` records the start and returns a `run_id`; the service does not launch the process. Keep Action lifecycle separate from run progress.

The starting authenticated connection supplies that run ID for ordinary `progress`, `wait`, `report` and `stop` updates, with a factual summary. A report includes actual outcome, remaining work and artifact references. A stop request is not a stopped confirmation. An unknown external outcome must be investigated before another attempt; `reconcile` records observed outcome/evidence without cancelling an external process.

Retain exact write arguments. On a missing response, use `operation_status` or identical replay, never a new operation ID. On a confirmed revision/version conflict, reread and reconcile rather than automatically approving a changed proposal. Collaboration history retains durable replay receipts beyond ordinary operation pruning.

## Change notifications and host support

In ChatGPT, the host owns the Remote MCP connection. Resource subscription and SSE are protocol features, not tools that the model can assume it can call. Use notifications only when the host exposes them. Installation does not establish host subscription, UI cache refresh or model wake-up. Without notifications, reread on the next user request; do not fabricate a subscription or promise automatic execution.

A direct Remote MCP client can check `initialize` for resource subscription support, subscribe to `action-state://current` through `resources/subscribe`, then open authenticated GET `/mcp` with `Accept: text/event-stream`. After `notifications/resources/updated`, reread `resources/read` for that URI or a complete business snapshot. Reconnect with `Last-Event-ID`; on cursor expiry, obtain a fresh snapshot and cursor. Renew expired subscriptions. The local stdio consumer does not relay these streams.

Notifications can repeat or coalesce. They signal a committed change, not a command or durable approval. Ordinary `get_changes` action deltas omit collaboration heads, so reread a complete snapshot before using proposal decisions. Preserve unsaved edits and exact unknown requests during refresh.
