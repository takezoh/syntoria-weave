---
change: change-20261029-client-write-approval
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

- FR-001: Before dispatching a mutation from a client connection (bearer token, `actor_kind` `client`), Weave shall apply the configured client write approval policy. Under `auto` the write proceeds; under `blocked` it is refused with HTTP 403 and error `client_write_denied`, and no operation or receipt is written.
- FR-002: A mutation by the person through a Gate browser session (`actor_kind` `user`) shall not be subject to the client write approval policy.
- FR-003: Reads, status lookups and metadata shall remain available to client connections under every policy.
- FR-004: `CLIENT_WRITE_APPROVAL` shall accept only `auto` or `blocked`, default to `auto`, and reject any other value at startup.
- FR-INV-001: No header, argument or client-supplied field shall select the actor kind or bypass the policy; the actor kind comes only from the verified credential type.

Counterexamples: a bearer request marked as the person by an argument; a blocked client write that leaves a receipt; the person's browser write refused because client writes are blocked; an unknown policy value accepted as `auto`.
