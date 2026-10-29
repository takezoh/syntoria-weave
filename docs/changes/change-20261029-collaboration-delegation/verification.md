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

## Production release

On 2026-10-29, source `dc0b0ef`, pushed to main as a fast-forward that also carries the earlier unreleased commits `7ccf77c` and `d185bca`, was released together with `change-20261029-ux-first-redesign` and `change-20261029-collaboration-delegation` as revision `weave-api-review-dc0b0ef` with image `sha256:acc07cd68a8e2dd132a9574a6b8319699083a7e93611f75c79906a7ca62199f5` (Docker Buildx, linux/amd64). See the [release evidence](../../evidence/20261029-ux-redesign-release/release.json).

- Backup execution `weave-backup-sptzh` succeeded before migration. Migrator execution `weave-migrator-pfpjq` applied 0010 and 0011 with the release image, and the new revision passed its startup schema check before receiving 100% traffic through a no-traffic tagged probe; the tag was removed. The previous revision cannot decode collaboration bodies after 0011; no errors were logged for it between migration and the switch.
- `grant-runtime weave_runtime` (execution `weave-migrator-x8dv6`) failed with 42501 at its final `ALTER ROLE ... CONNECTION LIMIT`, because the migrator lacks CREATEROLE. A read-only privilege check (`weave-migrator-z2cj8`) showed the earlier table grants applied: the runtime role has SELECT, INSERT and UPDATE on `state.client_names`, and its connection limit is already 40.
- The backup role does not yet have SELECT on `state.client_names`, so a backup after migration would fail. Granting it was not performed in this session and is pending the operator.
- Public checks after the switch: readiness 200, MCP with an invalid bearer 401, an untrusted-origin preflight 403, the SPA-origin preflight 204 with its exact origin, protected-resource metadata 200, an unauthenticated session 401. No errors were logged for the new revision at the recorded observation time.
- The static SPA is version `b76270ce-6d05-4070-a98c-8ea9e7d5d045`, built from the same source with freshly rendered runtime settings and hosting rules. All seven public files matched the candidate hashes with the expected cache, framing and credentialed CORS headers ([asset manifest](../../evidence/20261029-ux-redesign-release/asset-manifest.json), [public checks](../../evidence/20261029-ux-redesign-release/public-verification.json)).

Not verified in production: authenticated Web UI behavior in a real browser, hosted MCP writes with summaries, relayed client names and delegation, hosted assigned-resource notifications, ChatGPT widget rendering and its browser storage, and a backup after migration.
