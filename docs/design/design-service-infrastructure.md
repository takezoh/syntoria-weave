---
id: design-service-infrastructure
kind: design
title: Independent HTTP MCP service infrastructure
status: active
created: '2026-10-18'
scope_type: system
responsibilities: []
invariants: []
boundaries:
  provides: []
  consumes: []
  forbidden: []
variability:
  fixed: []
  free: []
capabilities: []
failure_responsibilities: []
trust_boundaries: []
compatibility_policies: []
tags: []
owners: []
relations: []
source_paths:
- lib/server
- lib/adapters
- lib/application/ports.ts
- build
- db/postgres
- infra
- scripts/admin.ts
- scripts/backup.ts
- scripts/build-node.mjs
- scripts/build-all.mjs
- scripts/run-framework.mjs
summary: Node HTTP composition, verified identities, PostgreSQL transactions and Cloud
  Run operations.
---

# Service infrastructure contract

## Responsibilities

The Node HTTP composition owns protocol/authentication and request-scoped capabilities. The application owns deterministic operation orchestration through store/clock/ID ports. The PostgreSQL adapter owns SQL, isolation, transaction locks and failure classification. Gate owns authorization-code/token issuance, connection approval and revocation; identity/session adapters resolve explicitly provisioned subjects. Infrastructure owns execution, secrets, deployment and restoration. The UI uses the same shared application through HTTP or MCP.

## Invariants

- FR-INV-001: Every committed operation atomically changes user state, revision, receipt, delta, identity markers and retained history, or changes none of them.
- FR-INV-002: User and full-access capabilities derive only from online-verified Gate connections and explicit enabled subject mappings. No business argument or public header can choose them.
- FR-INV-003: Different canonical input under a retained operation ID fails before graph validation/ID generation; identical replay returns the saved result and current state without reapplying it.
- FR-INV-004: Read snapshots and change windows have one database snapshot and committed user revision. A read creates no business/identity records.
- FR-INV-005: Unknown commit outcomes retain exact request identity. Rollback, timeout or reconnect cannot erase drafts or invent a replacement operation.
- FR-INV-006: HTTP and MCP use one domain/application and user-bound adapter. Thymesis has separate databases, APIs and deployment.

## Interfaces

UserActionStore remains the application-facing port. A verified principal binds user, full-access internal capabilities, issuer, subject and client; it is issued only by authentication/identity composition. PostgreSQL clients are adapter effects, never domain inputs. UI transport adapters do not store provider tokens or access PostgreSQL.

## Decisions and variability

Use Node 24, Fastify 5, pg, Drizzle PostgreSQL and Vite; Gate is the authorization server and shared browser-session owner. Each API validates the parent-domain browser cookie online for its own resource, then resolves the verified subject through explicit enabled PostgreSQL mappings and validates the configured browser client separately. The static SPA calls Gate and the API directly with credentials and CSRF protection; Weave does not keep browser tokens, refresh credentials or sessions. MCP clients continue to use authorization-code PKCE and opaque bearer-token introspection. Device approval grants full access without OAuth feature scopes. Use repeatable-read read-only transactions for snapshots and read-committed write transactions with transaction-scoped user advisory locks. Direct primary TLS connections and bounded pools avoid session-pool semantics. Terraform/IaC owns Cloud Run and related operations. Current numerical operating values, route/schema details and recovery procedures are normative in [infrastructure](../technical/infrastructure.md), [data model](../technical/data-model.md) and [deployment](../technical/deployment.md).

Resource identifiers, confidential resource clients, subject-to-user mappings and notification recipients are environment configuration. Changing provider, storage isolation, connection-approval semantics, canonical resource URI or API revision/replay semantics requires an explicit design revision and corresponding acceptance. Resource tuning requires measurement and connection-budget validation.

## Failure ownership

Auth boundary rejects unverifiable identity and never falls back to headers. PostgreSQL adapter distinguishes known pre-commit rejection from unknown COMMIT results; client recovery is lookup/identical replay. UI retains unresolved proposals. Release operator fences writes and verifies import before routing; restoring an earlier DB timeline requires explicit cursor/cache reset and authorization reconciliation.

## Verification

Use EARS requirements and observable counterexamples in the [change package](../changes/change-20261018-cloud-run-neon-infrastructure/requirements.md). Real PostgreSQL, deployed identity, Node transport and actual UI each need their own evidence. Design review and document validation are not app acceptance.
