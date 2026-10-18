---
id: change-20261018-user-identity-terminology
kind: change
title: Use user identity terminology across product contracts
status: active
created: '2026-10-18'
profile: sdd@1
intent: Use user identity terminology without changing identity values or isolation
  guarantees.
outcomes:
- Authenticated person identity is named user; persisted PostgreSQL isolation keys
  are user_id.
scope:
- lib/**
- app/**
- tests/**
- scripts/**
- build/**
- db/schema.ts
- db/postgres/migrations/0002_user_identity.sql
- eslint.config.mjs
- ARCHITECTURE.md
- AGENTS.md
- PRODUCT.md
- docs/development.md
- docs/technical/**
- docs/design/**
- skills/**
- docs/changes/change-20261018-user-identity-terminology/**
non_goals:
- Deploying or modifying live databases; renaming external ownership or immutable
  historical bytes.
change_classes:
- internal_design
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261018-user-identity-terminology/requirements.md
  required: true
- role: implementation
  path: changes/change-20261018-user-identity-terminology/implementation.md
  required: true
- role: verification
  path: changes/change-20261018-user-identity-terminology/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations: []
source_paths: []
summary: Rename Weave person identity contracts and PostgreSQL keys to user/user_id
  with a populated forward migration.
updated: '2026-10-18'
---

## Summary

## Closure Notes


{% transition from="draft" to="ready" date="2026-10-18" %}
Contracts and data-preserving forward migration are implemented and locally verified.
{% /transition %}


{% transition from="ready" to="active" date="2026-10-18" %}
Weave local implementation verified; cross-product terminology integration continues.
{% /transition %}
