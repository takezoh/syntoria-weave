---
change: change-20261018-node-postgres-service
role: requirements
---

# Requirements

## Contract

Implement the accepted contracts in [service infrastructure](../../design/design-service-infrastructure.md) and the [infrastructure design package](../change-20261018-cloud-run-neon-infrastructure/requirements.md).

- FR-1: HTTP, stateless MCP and the shared Web shell shall invoke the same application/domain path through verified owner capabilities.
- FR-2: The PostgreSQL adapter shall preserve CAS, duplicate-before-CAS replay, changed-input precedence, atomic changed rows/receipt/history, Undo, owner isolation and consistent snapshots without read-created state.
- FR-3: OAuth access-token and opaque-session entry shall reject unregistered/revoked identities, mixed credentials, incorrect scope/audience/issuer, unsafe Host/Origin and invalid CSRF.
- FR-4: Reauthentication shall retain the mounted proposal-owning frame and exact unresolved request, and shall prevent replay into another owner's account.
- FR-5: Administrative import shall require a fence and empty target, validate its digest and decoded graph/history before committing, and preserve supported Unicode code units and exact identifiers.
- FR-6: Source shall provide reproducible Node/container builds, migration and backup jobs, declarative GCP infrastructure, secret-version references, constrained identities and an explicit provider/release runbook.

## Scope and acceptance

Local implementation and reproducible verification are authorized. Remote provisioning, secret installation, production cutover and personal-data changes are not performed here. Real local PostgreSQL is required for adapter acceptance; mock/SQLite evidence is supplemental. Deployed Auth0/Neon/Cloud Run, custom-format restoration, latency objectives and individual client UI acceptance remain separate environment gates. No construction or installation prompts are part of this change.
