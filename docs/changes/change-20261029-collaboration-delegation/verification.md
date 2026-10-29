---
change: change-20261029-collaboration-delegation
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

Local working tree on 2026-10-29; not committed or deployed.

- `tests/domain/collaboration.test.mjs`: proposals default to any AI and stay the person's until accepted; a specified target is kept by acceptance and replaced by an accept payload; malformed targets (missing or blank client, spaces, a client with any AI, an unknown mode, a string, an extra field) are rejected; another client may start work specified for someone else; `assign` from a third client changes the target while the run continues, requires a target and the current version, and `revise` keeps it; persisted records require a valid member; assignment reasons for the specified client, another client, open work on unfinished and completed Actions, a run by this connection versus another connection of the same client, and the person.
- `tests/postgres/collaboration-delegation.test.mjs` (real PostgreSQL 17): migrating a 0010 database states any AI on an existing head and history record whose proposal text contains `"delegation":`, NUL and a lone surrogate, without changing that text, and keeps an existing subscription on the shared state. Over Node HTTP/MCP with two named AI connections and the person's browser session: unapproved work is listed as waiting on the person; an assigned-only stream sends its initial hint, nothing for an unrelated change, a hint at the approval that assigns the work, and a hint when the assignment moves away; the other AI may start the work and reassign it; history records each event's actor and target; another user sees nothing; unsubscribing ends stream eligibility; an unknown resource URI is refused. Sending assigned hints on every change was injected and failed the test, then restored.
- `tests/ui/collaboration.test.mjs`: a card shows "Yours until approved · then for any AI", offers any AI and named clients, sends one `assign` with the chosen target and current version, and later shows the specified AI and who started the run.
- `tests/application/mcp-display.test.mjs`: tools and resources list `list_assigned_collaborations`, `assign`, `delegation` and `action-state://assigned`.
- Final `pnpm check`: lint, typecheck and 655 tests passed, with no failures, cancellations, skips or TODOs. `pnpm build` and `pnpm test:node:built` passed.

## Limitations

Hosted services and real MCP hosts are not exercised; whether a host forwards resource notifications to a model is host-specific. Assigned hints compare item content on each poll; their cost at larger scale is unmeasured.
