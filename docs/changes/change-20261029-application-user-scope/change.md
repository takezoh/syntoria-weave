---
id: change-20261029-application-user-scope
kind: change
title: Enforce user scope in the application without PostgreSQL RLS
status: active
created: '2026-10-29'
profile: sdd@1
intent: Enforce user isolation through verified application capabilities without PostgreSQL
  RLS.
outcomes: []
scope:
- lib/adapters/postgres/
- db/postgres/migrations/0009_application_user_scope.sql
- scripts/backup.ts
- tests/postgres/
- docs/technical/
- ARCHITECTURE.md
non_goals:
- No change to Gate authentication or user identity mappings.
- No data reset or widening of public API access.
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261029-application-user-scope/requirements.md
  required: true
- role: implementation
  path: changes/change-20261029-application-user-scope/implementation.md
  required: true
- role: verification
  path: changes/change-20261029-application-user-scope/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations: []
source_paths: []
summary: Remove database row policies and connection context; migrate safely without
  BYPASSRLS while retaining user-bound SQL and history.
updated: '2026-10-29'
---

## Summary

Move user isolation to verified application capabilities and explicit SQL scope. Preserve data, exact history and migration checksums while removing PostgreSQL row policies and the need for privileged migration roles.

## Closure Notes
