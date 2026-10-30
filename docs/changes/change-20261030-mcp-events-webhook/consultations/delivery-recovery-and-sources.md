---
change: change-20261030-mcp-events-webhook
role: consultation
---

<!-- lifecycle is owned by change.md -->

# Delivery recovery decision and source snapshots

Answer to the design pursuit stopped on 2026-10-30 with "Cannot establish unconditional postcommit crash recovery with no future requests, no idle recovery execution and only postcommit Cloud Tasks enqueue".

## Owner decision: enqueue before commit

The owner chose this option on 2026-10-30 over a scheduled sweep and over recovery conditional on a later request.

- Inside the write transaction, after the pending delivery rows are written and before COMMIT, Weave creates the Cloud Tasks task for each pending delivery. The task name is derived from the pending delivery identity, so a repeated enqueue for the same delivery is deduplicated by Cloud Tasks.
- The Cloud Tasks task is the durable wakeup. It calls an internal Weave delivery endpoint. That endpoint reads the pending row:
  - committed and pending: check the connection with Gate, sign and send, then record the outcome;
  - absent: the write has not committed yet or rolled back. Answer with a retryable status for a bounded window that covers a slow commit, then finish without sending;
  - already delivered or stopped: finish without sending.
- A process exit after COMMIT therefore does not lose the event, and no Weave process, scheduler or polling runs while there is no change.
- This replaces "enqueue after commit" in requirements.md decision 3. The other decisions stand.
- The write path becomes slower by one Cloud Tasks create call per write that produces deliveries. Writes that produce no delivery make no call.
- If Cloud Tasks cannot be reached during the write, the write still commits and the pending rows stay marked as not enqueued. They are recovered on the next authenticated request to Weave, including a subscribed client's `events/subscribe` refresh. This degraded path is the only conditional recovery the owner accepts. The owner did not choose failing the write.

## Owner decision: one precommit wakeup per write

The design pursuit stopped a second time on 2026-10-30 with F-WAKEUP-FANOUT-BOUND. Neither subscriptions nor the deliveries produced by one change are bounded, so creating one Cloud Tasks task per delivery before COMMIT cannot be bounded in time. The owner chose a batch wakeup over subscription or write-admission limits and over another degraded-recovery exception.

- Before COMMIT, a write that produces pending deliveries creates exactly one Cloud Tasks task, named from that write's identity, such as its operation and committed revision. This one task is the durable wakeup for all of the write's pending deliveries. The write path cost is one create call, independent of the number of subscriptions.
- The wakeup task calls an internal Weave endpoint. That endpoint applies the commit check from the first decision to the write, then fans out per-delivery Cloud Tasks tasks from the committed pending rows. Each per-delivery task is named from its pending delivery identity, so the fan-out is idempotent and can be retried.
- Fan-out is bounded per invocation. When one invocation cannot create all per-delivery tasks within its bound, it creates a continuation task, named from the write identity and the fan-out position, before it returns. Recovery never depends on a later request while Cloud Tasks is healthy.
- Per-delivery tasks follow the first decision: Gate check, sign, send, bounded retry, 410/413 stop, and finish when the delivery is already done or stopped.
- No subscription quota and no rejection of valid writes are introduced. The only conditional recovery remains Cloud Tasks being unreachable during the write.

## MCP Events wire snapshot

Source: OpenAI, [MCP Events](https://developers.openai.com/plugins/build/mcp-events), read on 2026-10-30. It links the draft [MCP Events specification](https://github.com/modelcontextprotocol/experimental-ext-triggers-events/blob/main/docs/design-sketch-proposal.md) dated 2026-02-19. The quotes are verbatim.

- Protocol: "MCP Events in ChatGPT requires MCP 2.0 (protocol version `2026-07-28`)."
- Delivery: "ChatGPT supports webhook delivery and callback verification from the draft MCP Events specification." "Polling, streaming, and the draft's `gap` and `terminated` control notifications are not supported by this integration."
- Methods: "Implement these three event methods on the same authenticated MCP endpoint as your tools": `events/list`, `events/subscribe`, `events/unsubscribe`.
- Capability: "Add `events` to the capabilities returned by its `server/discover` response", example `"capabilities": {"tools": {}, "events": {}}` with `"supportedVersions": ["2026-07-28"]`.
- `events/list` result entry: `name`, `description`, `delivery: ["webhook"]`, `inputSchema`, `payloadSchema`. "`inputSchema` describes the arguments passed when ChatGPT subscribes, while `payloadSchema` describes the `data` object in each delivered event." Pagination: "return `nextCursor` and accept it as `cursor` on the next `events/list` request."
- `events/subscribe` params: `name`, `arguments`, `delivery: {mode: "webhook", url, secret}`, `cursor`. Result: `id`, `refreshBefore`, `cursor`, `truncated`.
  - Before accepting: check authorization, validate arguments, verify the callback, store the subscription.
  - Secret: "a `whsec_` signing secret whose base64 value decodes to 24–64 bytes".
  - Identity: "Derive a deterministic subscription ID from the authenticated principal, callback URL, event name, and arguments." Creation is idempotent. "Compare arguments using canonical JSON so object key order does not create duplicate subscriptions."
  - Lifetime: "ChatGPT refreshes expiring subscriptions by calling `events/subscribe` before `refreshBefore`, using the same subscription identity and the last saved cursor." With `ttlMs` omitted the server default applies. When given, grant no more than it, except a minimum lifetime that prevents excessive refresh. "`ttlMs: null` requests a subscription without expiration. Return `refreshBefore: null` only when granting that request. Otherwise, return a finite expiration and stop delivery when it passes."
  - Replay: "Return `cursor: null` for event types that do not support replay."
- Callback verification: Weave sends a signed body `{"type": "verification", "challenge": "<single-use random value>"}` with `webhook-id`, `webhook-timestamp`, `webhook-signature` and `X-MCP-Subscription-Id`. The endpoint echoes `{"challenge": "..."}`. "Require a `2xx` response and compare the returned challenge in constant time before activating delivery." "Cache successful verification by authenticated principal and callback URL for a bounded period." On failure: "return JSON-RPC error `-32015` (`CallbackEndpointError`) with a categorized `data.reason`, such as `challenge_failed` or `timeout`." The current draft lists `-32027` for `CallbackEndpointError` and says earlier revisions used `-32011` to `-32015`.
- Callback URL: "Require HTTPS for callbacks." "Block private, local, and other non-public addresses, and do not follow redirects."
- Event body: `{eventId, name, timestamp, data, cursor}`. Headers: `Content-Type: application/json`, `webhook-id` "The same value as the body's `eventId`.", `webhook-timestamp` "The signing time as Unix seconds.", `webhook-signature` "The Standard Webhooks HMAC signature.", `X-MCP-Subscription-Id` "The ID returned by `events/subscribe`." "Because the signature covers the event ID, signing timestamp, and exact request body bytes, serialize the body once and send those same bytes."
- Delivery rules: "A `2xx` response acknowledges webhook receipt." "Send one event per request, with a complete request body no larger than 256 KiB (262,144 bytes)." "Do not retry deliveries that return `410` or `413`." "Retry transient failures with exponential backoff and bounded attempts." Each retry gets "a fresh signing timestamp and signature". "Events can arrive out of order." For secret rotation, "sign with both the old and new keys using Standard Webhooks' space-separated signatures."
- `events/unsubscribe` params: `name`, `arguments`, `delivery: {mode: "webhook", url}`. Result `{}`. "Make unsubscribe idempotent and authorize it against the connected account."
- Server requirements: "provide persistent subscription storage and outbound HTTPS access to callback URLs."
- ChatGPT behavior: "ChatGPT receives the event in the subscribed chat and follows the user's instructions for how to respond." It is available in Work chats on ChatGPT web, in the desktop app with Cloud selected, and with dots.
- The draft says unauthenticated MCP servers may offer poll and push but not webhook.

## Gate validity boundary snapshot

Source: the Gate repository's `ARCHITECTURE.md`, `docs/security.md` and `packages/sdk/src/index.ts`, read on 2026-10-30.

- Gate is the identity and online authorization service. It has no BFF or application request proxy, and it maintains no MCP tool registry.
- Each DCR registration is one AI installation with a stable `client_id`. "Each approval creates a separate `connection_id`, which is the unit of revocation." "Resource servers may key per-AI state on issuer, subject and `client_id`."
- The SDK verifies OAuth and browser credentials online for every resource request, without caching positive results. Its principal is `{issuer, userId, connectionId, clientId, clientName?}`. Weave's request principal already carries `connectionId` and `clientId`.
- Precedent for a resource-authenticated Gate endpoint: change confirmations. The resource calls `/confirmations` with its introspection credentials. A confirmation "must name the configured account and an active OAuth connection of that account" and "stays valid only while that connection is approved".
- The SDK exposes only `createGateVerifier`, `createGateConfirmations` and `protectedResourceMetadata`. No API answers whether a connection ID is still valid without a token. This change requires one: a resource-authenticated Gate call that, given issuer, subject and `connection_id`, answers whether that connection is still approved, unexpired and not revoked. It is checked online before each delivery and never cached as positive. A not-valid answer stops the subscription. Gate being unavailable is a retryable delivery failure.
- The Gate change belongs to the Gate repository. The design defines the contract and Weave's port. Implementing and releasing the Gate side is a separate unit in that repository.
