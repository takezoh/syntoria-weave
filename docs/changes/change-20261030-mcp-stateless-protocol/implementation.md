---
change: change-20261030-mcp-stateless-protocol
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

## Protocol module

`lib/mcp/protocol.ts` is pure. It lists the legacy and modern versions, builds JSON-RPC errors, and `negotiate` selects a request's era: unsupported header versions and repeated headers fail first, notifications pass, requests without modern `_meta` or a modern header stay legacy, and modern requests are checked for `_meta` version, `Mcp-Method`, `Mcp-Name` (with Base64 sentinel decoding) and clientCapabilities. `observeRequest`, `observeReply` and `errorCause` produce the bounded log fields.

## Dispatcher

`dispatchMcp` takes `{headers, subscriptions}` and returns `{status, body, listen?, cause?}`. The legacy switch is unchanged apart from sharing resource reading, tool calls and capabilities with the modern switch. The modern switch wraps results with `resultType`, serverInfo and the cache fields, returns 404 for unknown methods, and turns `subscriptions/listen` into a `listen` directive with the accepted resources in canonical order; the transport owns streaming. The previous non-JSON-RPC 400 for unsupported versions in `server.ts` is replaced by these errors.

## Transport and streams

`server.ts` reads `Mcp-*` headers from raw headers so repeated values are detected before Node joins them. A shared `openStream` serves both the legacy GET stream and listen streams with the same limits (4 per user, 64 per process), cursor, revalidation and poll. For listen streams the filter comes from the request and nothing is stored. GET with the modern header returns 405 and with an unsupported header the JSON-RPC version error.

`mcpEventStream` takes a framing. Legacy framing is unchanged. Listen framing sends the acknowledgment first, ends with the completion result when nothing was accepted, tags every hint with the subscription ID and omits SSE IDs and `retry`. The lifetime bound (about 25 seconds, under the 30-second Cloud Run timeout) ends a listen stream without a completion result, deliberately treating it as a transport timeout so that clients reconnect, because the completion result signals a graceful end of the subscription.

## Logging

A per-request map collects bounded fields: `observeRequest` at entry, `observeReply` and the tool failure cause after dispatch, and the HTTP error code with `errorCause` in the error handler and the 415 path. `onResponse` adds them and the HTTP method to the existing line. Stream failures other than abort call `onError`, which logs `mcp_stream_error`.

## Text

Tool and resource descriptions say that a client supporting resource notifications can subscribe, and otherwise reads again. The Skill names `subscriptions/listen` for 2026-07-28 and `resources/subscribe` with GET for earlier revisions. The standalone local consumer keeps sending 2025-11-25.
