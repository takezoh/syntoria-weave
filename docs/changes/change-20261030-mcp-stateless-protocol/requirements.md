---
change: change-20261030-mcp-stateless-protocol
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

## Protocol eras

- FR-001: When a POST /mcp request carries `MCP-Protocol-Version: 2026-07-28`, the server shall serve it statelessly, without `initialize` or a session, after the existing authentication and capability checks.
- FR-002: When a request carries no protocol header, or a 2025-03-26, 2025-06-18 or 2025-11-25 header, and no modern `_meta` protocol version, the server shall keep the existing legacy behavior.
- FR-003: When the protocol header names an unsupported version, the server shall return HTTP 400 with JSON-RPC error -32022 whose `data` lists the supported versions and the requested one, for either era.
- FR-004: When a 2026-07-28 request's `_meta` protocol version differs from the header, its `Mcp-Method` header differs from `method`, its `Mcp-Name` header (plain or `=?base64?…?=`) differs from a tools/call name or resources/read URI, or any of these headers is repeated, the server shall return HTTP 400 with -32020 and shall not invoke the tool.
- FR-005: When a 2026-07-28 request lacks `_meta` clientCapabilities, the server shall return HTTP 400 with -32602.
- FR-006: The 2026-07-28 era shall support `server/discover`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `resources/templates/list` and, where subscriptions are configured, `subscriptions/listen`. Other methods, including `initialize`, `ping` and `resources/subscribe`, shall return HTTP 404 with -32601.
- FR-007: 2026-07-28 results shall carry `resultType: "complete"` and `_meta` serverInfo; discover, list and read results shall carry `ttlMs: 0` and `cacheScope: "private"`. Tool and resource content shall equal the legacy content. An unknown resource shall return -32602.
- FR-008: Notification POSTs shall receive 202 without modern header checks.

## Change notifications

- FR-009: A `subscriptions/listen` request shall receive an SSE response whose first message is `notifications/subscriptions/acknowledged` listing the accepted subset of `resourceSubscriptions`; list-change types and unknown resources shall be omitted. Every message shall carry `io.modelcontextprotocol/subscriptionId` equal to the request ID and no SSE `id`.
- FR-010: After the acknowledgment the stream shall send the same refresh and change hints as the legacy stream for the accepted resources, revalidating the connection before each check, and shall store no subscription.
- FR-011: A listen request with nothing accepted shall receive the acknowledgment and the completion result, then end.
- FR-012: A listen stream shall end without a completion result at the existing lifetime bound or when the connection is no longer valid, so a client treats it as a disconnect.
- FR-013: GET /mcp with the 2026-07-28 header shall return 405; legacy GET streams are unchanged.

## Observability

- FR-014: Each request log line shall include the HTTP method and, for /mcp, the requested protocol version, JSON-RPC method, tool name, client name and version and declared extension identifiers, each restricted to its expected shape and otherwise logged as `invalid` (repeated headers as `ambiguous`).
- FR-015: The log line shall include the JSON-RPC or tool error code of the reply, the HTTP error code of a rejected request, and for unexpected failures only the error class and system or SQLSTATE code.
- FR-016: A stream that ends with a failure other than a client disconnect shall log one line with its request ID and failure class.
- FR-017: Logs shall never contain tool arguments, content, error messages, tokens or user data.

## Counterexamples

- A dual-era client that probes 2026-07-28 shall not receive a non-JSON-RPC 400 that makes it fall back.
- A tool call whose `Mcp-Name` names a different tool shall not run either tool.
- A listen request shall not create a row in `state.mcp_subscriptions`.
