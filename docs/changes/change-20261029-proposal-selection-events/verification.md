---
change: change-20261029-proposal-selection-events
role: verification
---

# Verification

## Coverage

- Domain: three retained choices, capacity refusal, exclusive approval, preservation on cancellation, editing clears approval, unknown/running work blocks another approval, existing lifecycle isolation.
- PostgreSQL: concurrent fourth-proposal and competing-approval attempts; cancellation preserves all records; exact replay and history coverage retained.
- UI/controller/DOM: all three choices remain visible, rejection absent, direct editing retains nodes and draft text, stale version retained on remote correction, saving does not approve.
- Node HTTP/MCP with real PostgreSQL and Gate fixture: subscription on one server and SSE on another, UI approval/edit/cancellation notifications, resource readback, connection/user isolation, cursor reconnection and revocation closure.
- Built Node process: authenticated subscription and streamed standard notification over real HTTP/PostgreSQL.

## Limits

No deployment or hosted migration has been performed for this package. Local Gate/PostgreSQL fixtures do not establish production browser, ChatGPT, Dots or local stdio host notification handling. SSE is a live invalidation mechanism with finite receipt retention, not a guaranteed agent wakeup or exactly-once event queue. Existing schema compatibility requires migration and grants before deploying this source.

## Final local results (2026-10-29)

| Check | Result |
| --- | --- |
| `pnpm check` | Passed: lint, typecheck, 617 tests; zero failed, cancelled, skipped or TODO tests. |
| `pnpm build` | Passed for API, static SPA, local MCP and plugin template. |
| `pnpm test:node:built` | Passed, including authenticated Remote MCP subscription and SSE notification from the built process. |
| `docs lint` | Passed, 90 indexed documents and no warnings. |
| `docs lint --conformance` | Unexecuted to completion: the existing document graph tool raises `AttributeError` on string entries in existing `boundaries.forbidden` metadata. No conformance success or package closure is claimed. |
| `git diff --check` | Passed. |

The package remains active because document conformance/closure cannot complete. No production feature acceptance is claimed; the currently deployed source is the previous release.
