---
change: change-20261029-collaboration-delegation
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

`CollaborationDelegation` in `lib/data/types.ts` is `{mode:'any_ai',client_id:null}` or `{mode:'specified_ai',client_id}`. `collaborationDelegation` validates input; `createCollaboration` defaults to any AI; `accept` keeps or replaces it; `assign` replaces it for the current version in any state; `persistedCollaboration` requires it. `collaborationHandler` derives the person, any AI or the specified AI. `needsPerson` moved from the UI model to the domain so the UI and the service share one definition, and `assignmentReason` derives `assigned_to_you`, `open_to_any_ai`, `your_run` or `waiting_on_you` for an actor. No transition reads delegation to reject a write.

`collaborationCall` accepts `delegation` on `propose_collaboration` and in `adopt` payloads and serves `list_assigned_collaborations` from the store's verified `collaborationActor`. Complete snapshots add `clients` from the recorded client names for display.

`action-state://assigned` is listed and readable through the dispatcher. `McpSubscriptions` stores one row per connection and resource (`set(principal,resource,subscribed)`, `list(principal)`). The event stream requires at least one subscription, re-lists them on each cycle after revalidating the connection, sends shared-state hints as before when subscribed, and sends an assigned hint at connection and whenever the connection's assigned items differ from the previous cycle.

Migration `0011_collaboration_delegation.sql` splices `"delegation":{"mode":"any_ai","client_id":null}` in front of every collaboration head and history body and rekeys `state.mcp_subscriptions` by resource, keeping existing rows on the shared state. The runtime schema check expects 0011 and transfer moves to version 9.

The controller's `assignCollaboration` sends `assign` through the serialized write lane. `delegationView` gives each card its handler text, starter and target choices (any AI and the clients the snapshot knows, plus any referenced client), and the collaboration panel renders them with a selector.

## Release impact

Apply 0011 with 0010; no grants change. The previous image cannot read collaboration bodies after the migration. Transfer files must use version 9. Clients that only know the old tools keep working; new tools, the `delegation` argument and the second resource appear after discovery refresh. A specified AI is shown by name only after it has written with a relayed name; otherwise by a client ID prefix.
