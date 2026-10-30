---
change: change-20261030-mcp-events-webhook
role: ux
---

<!-- lifecycle is owned by change.md -->

# Experience contract

Observable behavior for the person and for a subscribed AI client. Decisions, evidence and constraints are in [requirements.md](requirements.md).

## Actors

- The person, using the Weave UI.
- A subscribed AI client, such as ChatGPT in a Work chat, connected to Weave's Remote MCP endpoint with protocol `2026-07-28` and an approved Gate connection.

## Scenarios

### S1 Discover events

- Given an AI client connected with `2026-07-28`,
- when it calls `server/discover`, then the capabilities include `events`;
- when it calls `events/list`, then it receives each event with `delivery: ["webhook"]`, an argument schema and a payload schema.

### S2 Subscribe with a verified callback

- Given the client calls `events/subscribe` with an HTTPS callback URL and a `whsec_` signing secret,
- when Weave sends a signed verification challenge and the callback echoes it with a 2xx,
- then the subscription becomes active and the response returns a stable `id` and `refreshBefore`.
- Repeating the same subscribe returns the same `id` and creates no second subscription.

### S3 Ask AI reaches the subscribed AI

- Given an active subscription for the connection the request concerns,
- when the person sends Ask AI from an Action in the UI and the write commits,
- then the callback receives one signed event identifying the collaboration and revision, and the AI can read the current state through existing tools and start work.
- The same applies when other collaboration changes make work relevant to that connection, such as approval or edits, whether the change came from the UI or from another MCP client.

### S4 Nothing runs while waiting

- Given subscriptions exist and no change occurs,
- then Weave holds no connection, runs no polling and keeps no instance active for event delivery.

### S5 Delivery survives failures

- Given the callback is temporarily unavailable, or the Weave process stops right after commit,
- then the event is delivered later with bounded retries and a fresh signature for each attempt.
- A callback that answers `410` or `413` receives no retry.

### S6 Revocation and expiry stop delivery

- Given the person revokes the AI's connection in Gate, or the subscription passes its expiry without refresh,
- then Weave sends no further events to that callback.

### S7 Unsubscribe

- Given the client calls `events/unsubscribe` for its subscription, possibly twice,
- then delivery stops and both calls succeed.

## Counterexamples

- C1 A subscription is never activated before the callback echoes the challenge, and a callback on a private, local or redirecting address is rejected.
- C2 An event never contains Action text, notes, collaboration text or other personal content, only identifiers and revision.
- C3 A rolled-back or rejected write produces no event.
- C4 Another user's or another connection's work never produces an event for this subscription.
- C5 An event never starts, approves or completes work by itself; it is a hint.
- C6 Existing `resources/subscribe`, GET SSE and `subscriptions/listen` behave exactly as before, and the 2025 revisions see no `events` capability.

## Legacy delta

- New: the `events` capability and `events/*` methods on `2026-07-28`, outbound signed webhooks, and a Gate connection-validity check.
- Unchanged: tools, resources, receipts, Undo, revision and replay semantics, and the existing resource subscription.
