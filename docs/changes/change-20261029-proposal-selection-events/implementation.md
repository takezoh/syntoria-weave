---
change: change-20261029-proposal-selection-events
role: implementation
---

# Implementation

## Proposal contract

Keep the existing collaboration head and immutable history format. The pure domain enforces three retained heads per linked Action, exclusive approval, scope versioning and unresolved-run guards. CAS protects the capacity and selection checks in the existing PostgreSQL commit transaction. Unlinked suggestions do not form an Action proposal group until adopted; adoption checks the target's remaining capacity. Adoption without delegation leaves a pending proposal linked to the resulting Action.

`reject` is removed from the published command schema and domain transitions. `withdraw` cancels approval and preserves the head as pending. Old rejected/withdrawn records remain decodable; no deployed history or receipt is rewritten. A pending record with an ended run must be revised before a new run, preserving evidence in history.

The UI renders every linked proposal, including cancelled approvals. Each card offers approval and direct editing; approval is unavailable while another choice is approved or unresolved. A typed controller draft retains the original proposal version. Rendering never initializes drafts. Saving uses the existing exact-operation recovery lane. The editor explains that saving clears approval.

## MCP notifications

The Remote MCP resource `action-state://current` reads the current full user snapshot. `initialize` advertises `resources.subscribe:true` when the server is composed with its subscription adapter. `resources/subscribe` and `resources/unsubscribe` set connection-scoped delivery metadata. Migration `0008_mcp_subscriptions.sql` stores these records with user-bound RLS and a 24-hour expiration; Gate remains the source of authorization. This metadata is excluded from logical business transfer; physical backups may include it, but restored metadata cannot bypass online authentication.

An authenticated `GET /mcp` accepting `text/event-stream` opens a bounded SSE stream after subscription. Notifications use `notifications/resources/updated`, a fixed resource URI and optional metadata with a revision and change cursor. Event IDs use the existing user/epoch-scoped change cursor. Initial connection always emits a refresh hint, so changes between subscription and stream establishment are not hidden. Reconnect with `Last-Event-ID`; cursor failure requires a fresh snapshot. Delivery can be coalesced or duplicated: notifications are invalidations, not exactly-once business events. Full reports and provenance remain in durable collaboration history.

The transport polls the durable operation feed only while connected, roughly every two seconds, and revalidates authentication and subscription before delivery. It releases DB connections between queries. Streams close after approximately 25 seconds and advertise a two-second reconnect delay, fitting the existing Cloud Run request boundary. Per-process limits are four streams per user and 64 total; these are resource guards, not global connection guarantees. Subscriptions are shared across API instances by database storage. No service scheduler, agent launcher, recommendation engine or external effect grant is introduced.

The standalone local stdio consumer does not relay SSE subscriptions in this change. Remote MCP clients must implement standard resource subscriptions and the GET event stream. Actual host behavior remains a separate acceptance boundary.
