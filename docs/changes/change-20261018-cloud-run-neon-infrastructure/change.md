---
id: change-20261018-cloud-run-neon-infrastructure
kind: change
title: Design independent Cloud Run and Neon infrastructure
status: ready
created: '2026-10-18'
profile: sdd@1
intent: Define implementable independent-service infrastructure and preserve all state,
  recovery and UI contracts.
outcomes:
- Concrete runtime, authentication, storage, IaC, release and restore contracts with
  traceable acceptance.
- Current design documents agree; no implementation, deployment or independent review
  is claimed.
scope:
- ARCHITECTURE.md
- AGENTS.md
- docs/technical
- docs/development.md
- docs/design/design-service-infrastructure.md
- docs/adr/adr-20261018-backend-contracts.md
- docs/design/product.md
- docs/adr/adr-20261018-cloud-run-neon.md
non_goals:
- Runtime implementation or resource provisioning
- Deployment or personal-data mutation
- Construction prompts or client installation
change_classes:
- boundary
- internal_design
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261018-cloud-run-neon-infrastructure/requirements.md
  required: true
- role: implementation
  path: changes/change-20261018-cloud-run-neon-infrastructure/implementation.md
  required: true
- role: verification
  path: changes/change-20261018-cloud-run-neon-infrastructure/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- {type: introduces, target: design-service-infrastructure}
- {type: conformsTo, target: design-effect-boundaries}
- {type: references, target: adr-20261018-cloud-run-neon}
- {type: references, target: adr-20261018-backend-contracts}
source_paths: []
summary: Implementation-ready infrastructure, identity, PostgreSQL and release contracts
  for the independent shared-state service.
updated: '2026-10-18'
---

## Summary

The current design specifies Node/Fastify HTTP and MCP, Vite shared UI, Auth0 identity/session boundaries, real PostgreSQL transaction and type mappings, bounded Cloud Run/Neon configuration, IaC/release, write-fenced cutover and verified restoration. The governing design and technical references are updated; this package contains traceable requirements, implementation outcomes and verification obligations.

## Verification boundary

This is a direct main-session design authorized by the user. Document checks and source/contract self-review are recorded in verification.md. Runtime implementation, infrastructure creation, hosted acceptance and independent review have not been performed.
