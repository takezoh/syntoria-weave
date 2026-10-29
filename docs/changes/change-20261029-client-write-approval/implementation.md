---
change: change-20261029-client-write-approval
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

`lib/server/node/principal.ts` defines `ClientWriteApproval` and `WritePolicy` and extends `authorize` to take the policy: after the scope and `WRITE_MODE` checks, a mutator from a principal whose `actorKind` is `client` is refused unless the policy is `auto`. An unset policy is treated as not `auto`, so a missing value fails closed. `lib/server/node/config.ts` reads and validates `CLIENT_WRITE_APPROVAL`; `lib/server/node/server.ts` passes the service configuration to every `authorize` call on `/api/session`, `/api/actions` and `/mcp`. Configuration literals in local preview and verification scripts set `auto`.

The person's writes come only from a Gate browser session with registered Origin and CSRF. Writes made inside an AI host's embedded UI or the standalone local browser workspace use that client's bearer connection and are therefore governed by the policy.
