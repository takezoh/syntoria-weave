---
id: change-20261018-node-postgres-service
kind: change
title: Implement independent Node PostgreSQL service and infrastructure
status: active
created: '2026-10-18'
profile: sdd@1
intent: Implement the accepted independent TypeScript Node/PostgreSQL service, authentication,
  infrastructure and real-adapter verification.
outcomes:
- Production Node HTTP/MCP and shared Web UI compose verified identity with real PostgreSQL
  and preserve operation guarantees.
- Container, migration/admin/backup tooling and deployable infrastructure definitions
  are validated without provisioning remote resources.
scope:
- .github
- package.json
- pnpm-lock.yaml
- Dockerfile
- .dockerignore
- .gitignore
- drizzle.config.ts
- tsconfig.json
- eslint.config.mjs
- docs/technical
- docs/development.md
- AGENTS.md
- ARCHITECTURE.md
- pnpm-workspace.yaml
- lib/**
- app/**
- db/**
- build/**
- scripts/**
- tests/**
- infra/**
- web/**
non_goals: []
change_classes:
- boundary
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261018-node-postgres-service/requirements.md
  required: true
- role: implementation
  path: changes/change-20261018-node-postgres-service/implementation.md
  required: true
- role: verification
  path: changes/change-20261018-node-postgres-service/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- {type: conformsTo, target: design-service-infrastructure}
- {type: conformsTo, target: design-effect-boundaries}
- {type: references, target: change-20261018-cloud-run-neon-infrastructure}
source_paths: []
summary: Implement approved HTTP/MCP, identity, PostgreSQL, build and deployment configuration
  contracts.
updated: '2026-10-18'
---

## Summary

Implement the approved independent Node/PostgreSQL service with real-adapter and built-process verification. Deployment is a separate environment operation.

## Closure Notes


{% transition from="draft" to="ready" date="2026-10-18" %}
Requirements and bounded implementation recorded; local verification evidence available.
{% /transition %}


{% transition from="ready" to="active" date="2026-10-18" %}
Implementation and local source, PostgreSQL, built-process, container and IaC checks passed; remote acceptance remains explicitly separate.
{% /transition %}
