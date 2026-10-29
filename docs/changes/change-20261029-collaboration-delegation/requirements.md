---
change: change-20261029-collaboration-delegation
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

Decisions by the owner on 2026-10-29: Weave holds state and does not restrict who may change it; every authorized AI and the person may edit all data, and the change history records when, how and by which AI. An Action is the person's work unless a proposal is approved or work is requested or delegated to AI. Existing guards and the 30-day history stay as they are.

## Delegation target

- FR-001: Every collaboration record shall carry `delegation`, either `{mode:"any_ai",client_id:null}` or `{mode:"specified_ai",client_id}` with a nonempty visible client ID of at most 255 characters. The mode and the client are separate fields; no string value stands for "any AI".
- FR-002: A proposal shall default to `any_ai` unless `propose_collaboration` supplies `delegation`. `accept`, and `adopt` with `delegate:true`, may supply `delegation`; otherwise the record keeps its current value. `revise` keeps it.
- FR-003: The `assign` command shall replace `delegation` for the current proposal version in any decision or progress state, from any authenticated actor, as an ordinary collaboration event with its actor in history.
- FR-004: Who handles work shall be derived, not stored: a record that is not accepted, and an Action without an accepted record, is the person's; an accepted record is handled by any AI or the specified AI according to `delegation`.
- FR-INV-001: Weave shall not reject, filter or require any write because of `delegation`. In particular `start` shall accept any connection, whatever the delegation says. Existing guards (run reports by the starting connection, procedure states, operator client-write approval) are unchanged.

## Finding one's work

- FR-101: `list_assigned_collaborations` shall return, for the authenticated connection, collaboration records with a reason: `assigned_to_you` (accepted and specified for this client), `open_to_any_ai` (accepted, any AI, unstarted, not stopping, unfinished Action), `your_run` (started by this connection and running, waiting, stopped, stop-requested or with an unknown outcome), and for the person `waiting_on_you` (the same definition the UI uses). "You" comes only from the verified connection, never from arguments.
- FR-102: Remote MCP shall list a second resource, `action-state://assigned`, whose read returns the same content as `list_assigned_collaborations` for the reading connection.
- FR-103: A connection may subscribe to either resource or both. The event stream shall send `notifications/resources/updated` for `action-state://current` on every committed change, as today, only when that resource is subscribed, and for `action-state://assigned` once at connection and afterwards only when the reading connection's assigned content changes.
- FR-INV-002: Notifications are hints to read again; they never authorize work. Subscriptions remain connection-scoped metadata without business revision.

## UI

- FR-201: A collaboration card shall show who should handle approved work (any AI, or the specified AI by its name or client ID), who is running it, and let the person change the delegation target among any AI and the clients the snapshot knows.

Counterexamples: a string such as "any" inside a client field; `start` refused because another AI was specified; delegation changes missing from history; an assigned notification on every unrelated change; a notification revealing another user's records; "you" taken from a request argument.
