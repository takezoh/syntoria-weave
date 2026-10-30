---
change: change-20261030-mcp-stateless-protocol
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

Local working tree on 2026-10-30, before commit.

## Commands

- `pnpm check`: lint, typecheck and 677 tests passed, with no failures, cancellations, skips or TODOs.
- `pnpm build`: passed.
- `pnpm test:node:built`: passed, including `mcp_modern` (server/discover and a listen stream acknowledgment before the first hint on the built process, and the discover method in its log output).

## Pure protocol (tests/application/mcp-protocol.test.mjs)

- server/discover lists 2026-07-28 and the legacy versions, the subscription capability only when subscriptions are configured, serverInfo, `ttlMs:0`, `cacheScope:"private"` and the same instructions as initialize (FR-006, FR-007).
- Modern tools/list and resources/list equal the legacy content; reads return contents or -32602 with the URI (FR-007).
- tools/call runs with a plain or Base64-sentinel `Mcp-Name`; a missing, different, repeated or malformed name returns 400 -32020 without invoking the tool; a missing name returns 400 -32602; domain errors stay `isError` results; unexpected failures record only `Error 42P01` (FR-004, FR-015).
- `_meta`/header version mismatch in both directions, a missing header, a mismatched or repeated `Mcp-Method`, a repeated version header and missing clientCapabilities are rejected with the specified codes; a request without ID is invalid; initialize, ping, resources/subscribe and prompts/list return 404 -32601; notifications get 202 (FR-004–FR-006, FR-008).
- Unsupported versions return 400 -32022 with the supported list and the request ID for modern and legacy bodies (FR-003).
- subscriptions/listen returns the accepted resources in canonical order, an empty list for unsupported types, 400 for a missing or array filter, 404 without subscriptions, and never stores a subscription (FR-009, FR-011).
- Legacy initialize, ping, resources/subscribe are unchanged and server/discover and subscriptions/listen are unknown to the legacy era (FR-002).
- Observations contain only bounded fields; tool arguments, an email-shaped client name, a line break and an invalid tool name or version are excluded or logged as `invalid`; error causes never include messages (FR-014, FR-015, FR-017).

## Node HTTP and real PostgreSQL

- `tests/postgres/server.test.mjs`: discover, tools/list, a modern write with identical replay, a mismatched `Mcp-Name` that does not write, a repeated `MCP-Protocol-Version` over a raw socket, the unsupported-version body, 404 for ping, 404 for listen on a server without subscriptions and legacy initialize on the same server; log lines carry method, version, client, tool, JSON-RPC and tool error codes and the 401 error code, and no written title (FR-001–FR-008, FR-014–FR-017).
- `tests/postgres/mcp-events.test.mjs`: over real HTTP, a listen with nothing accepted receives the acknowledgment, the completion result and the end; a listen for the current resource receives the acknowledgment with the unknown resource omitted, the initial hint and a hint at the revision of a browser write, all tagged with the subscription ID and without SSE IDs; no subscription row is stored; GET with the modern header returns 405; revocation ends the stream and logs `mcp_stream_error` with `unauthenticated` (FR-009–FR-013, FR-016).
- The existing legacy GET stream, resumption, revocation and collaboration-delegation suites pass unchanged.

## Not verified

- Deployed Cloud Run/Neon behavior and whether ChatGPT or Codex now stay on 2026-07-28, call subscriptions/listen, render the UI or deliver hints to a model. These require deployment and production log observation.
- That the 400 seen in production was a 2026-07-28 probe: request bodies were not logged, so this remains an inference from the request pattern.
