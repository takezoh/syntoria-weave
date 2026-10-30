---
change: change-20261030-mcp-stateless-protocol
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

Local working tree on 2026-10-30, verified before commit `c6c85bf`.

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

## Production release

On 2026-10-30, source `c6c85bf`, pushed to main as a fast-forward, was released as revision `weave-api-mcp-c6c85bf` with image `sha256:82cb1823871bb54816a39e6c4100f00b518dffc981e4bb21f573f0d4d6457f51` (Docker Buildx, linux/amd64), replacing `weave-api-nav-10da467`. See the [release evidence](../../evidence/20261030-mcp-stateless-release/release.json).

- No schema or administrative code changed, so no backup or migration ran and the jobs keep their previous image. The no-traffic tagged revision answered liveness and readiness with 200 before receiving 100% of traffic; the tag was removed.
- Public checks after the switch: readiness 200, an untrusted-origin preflight 403, the SPA-origin preflight 204 with its exact origin and credentials, protected-resource metadata 200 and an unauthenticated session 401. MCP with an invalid bearer returned 401 for a legacy tools/list and for a 2026-07-28 server/discover, the latter with the protected-resource metadata challenge, so authentication still precedes era handling. The revision logged nothing above the probes' expected 4xx, and the two MCP lines carried the new method, version and error fields.
- The static SPA was not redeployed: every built file has the same hash as the published release.

Not verified in production: an authenticated 2026-07-28 tool call and listen stream; whether ChatGPT and Codex now stay on 2026-07-28, stop receiving the per-call 400 or call subscriptions/listen; ChatGPT widget rendering under the new era. No ChatGPT request had reached the revision when this was recorded. The nightly backup is still blocked until the backup role can read `state.client_names`.
