---
id: adr-20261018-backend-contracts
kind: adr
title: Choose Node service identity transaction and deployment contracts
status: accepted
created: '2026-10-18'
decision_makers:
- main-session under user-authorized direct design
tags: []
owners: []
relations:
- {type: references, target: adr-20261018-cloud-run-neon}
source_paths: []
summary: Fastify and pg, Auth0 OAuth and Web sessions, transaction advisory locking
  and Terraform-managed Cloud Run.
updated: '2026-10-18'
---

# Concrete backend contracts

## Decision

Use Node.js 24 LTS and Fastify 5 for a single stateless HTTP service, pg direct-primary connections, Drizzle PostgreSQL migrations and Vite static UI composition. Auth0 supplies OAuth/OIDC; verify API tokens locally and use opaque PostgreSQL-backed Web sessions. Use explicit subject/client grants and state:read/state:write scopes.

Use PostgreSQL 17, repeatable-read read-only snapshots and read-committed write transactions serialized by transaction-scoped owner advisory locks. Recheck receipt before revision under the lock. Derive owner revision from retained operations; no owner-wide JSON state or read-created coordination row. Force RLS in addition to explicit owner predicates.

Deploy to Cloud Run asia-southeast1 and Neon aws-ap-southeast-1. Production has a warm API instance and no DB autosuspend. Terraform and GitHub OIDC WIF manage releases; separate migration/backup jobs from the API. Backend protocols are ordinary HTTP/MCP.

## Rationale and alternatives

A plain Node HTTP service fits the existing shared UI without introducing SSR and removes transport-specific runtime coupling from composition. Fastify provides explicit route/hook boundaries; keeping vinext/App Router or replacing the shared UI with another UI framework adds no required capability. pg exposes checked-out-client transaction control; an HTTP-per-query driver does not provide this interactive transaction contract.

A managed authorization server avoids implementing token issuance, consent, PKCE and registration in the state service. Auth0 documents MCP resource support. Google sign-in alone does not issue arbitrary resource-scoped MCP access tokens. Self-hosted Keycloak or a custom authorization service increases operational scope; opaque static API keys alone do not satisfy delegated OAuth.

Owner transaction advisory locks cover an empty owner's first write without a persistent state blob. A coordination row is viable but unnecessary; a full serializable application transaction would require replaying application work and retaining connections longer. The lock plus revision CAS is sufficient because all business writes pass through the same adapter and imports run only under a global write fence. Consistent reads use a separate repeatable-read transaction; default statement snapshots alone are insufficient.

Neon's region list includes Singapore but not Tokyo; pairing the API there avoids deliberately separating API and database. This is a placement decision, not measured performance superiority. Warm settings trade recurring cost for lower idle-start delay.

## Consequences

Positive: explicit protocol and effect boundaries, familiar Node execution, native transaction guarantees and independently testable deployments.

Negative: managed identity configuration, cross-provider DB traffic, recurring warm-instance/DB cost, and additional IAM/backup/release operations.

Neutral: product semantics, operation/history limits, dirty proposals and standard MCP remain unchanged; no queues, recommendation service or shared Thymesis DB are introduced.

## Confirmation

Verify with the source/contract review matrix and runtime acceptance in [verification](../changes/change-20261018-cloud-run-neon-infrastructure/verification.md). Source reading established the required store methods, lazy replay comparison, post-commit fresh read, seven logical tables and schema/byte budgets; no Node/PostgreSQL infrastructure or deployment test has been run as part of this design.

## Sources

- [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [Auth0 resource compatibility](https://auth0.com/ai/docs/mcp/guides/resource-param-compatibility-profile)
- [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [PostgreSQL advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html)
- [Neon regions](https://neon.com/docs/introduction/regions)
- [pg transactions](https://node-postgres.com/features/transactions)

External documentation checked 2026-10-18. The user authorized direct design after the skill execution route failed; this record is the main session's technical decision, not an independent reviewer verdict.
