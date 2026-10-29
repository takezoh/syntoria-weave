---
id: change-20261029-client-write-approval
kind: change
title: Approve client connection writes by policy
status: draft
created: '2026-10-29'
profile: sdd@1
intent: Give the owner a control over writes that AI and other client connections
  make, separate from the person's own writes in the Weave app, while approving every
  client write automatically for now.
outcomes:
- A client connection's write is admitted by a configured approval policy; `auto`
  approves it at once and `blocked` refuses it with `client_write_denied`, without
  a receipt.
- The person's writes through a Gate browser session need no approval under either
  policy.
- The policy defaults to `auto`, so current behavior is unchanged.
scope:
- lib/server/node/**
- scripts/local-preview.mjs
- scripts/testing/**
- tests/postgres/**
- docs/technical/**
non_goals:
- Per-change approval at Gate for client writes; the policy can grow a `gate` value
  later.
- Per-client or per-tool policies.
- Telling a click in an AI host's embedded UI from the AI; such writes stay `client`.
- Production deployment.
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261029-client-write-approval/requirements.md
  required: true
- role: implementation
  path: changes/change-20261029-client-write-approval/implementation.md
  required: true
- role: verification
  path: changes/change-20261029-client-write-approval/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations: []
source_paths: []
summary: CLIENT_WRITE_APPROVAL (auto|blocked, default auto) governs writes from client
  connections; the person's browser writes need no approval.
---

## Summary

On 2026-10-29 the owner asked that AI and human operations be told apart and that a controllable approval mechanism exist, with every AI change approved automatically for now. Weave already records `actor_kind` (`user` for a Gate browser session, `client` for a bearer connection). This change adds `CLIENT_WRITE_APPROVAL` (`auto` | `blocked`, default `auto`), checked with the existing write fence before any mutation from a client connection. Nothing is committed or deployed.

## Closure Notes
