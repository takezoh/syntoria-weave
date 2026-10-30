---
id: change-20261030-mcp-stateless-protocol
kind: change
title: Serve MCP 2026-07-28 beside the legacy revisions and log bounded MCP errors
status: draft
created: '2026-10-30'
profile: sdd@1
intent: ChatGPT reported that it has no tool to subscribe to MCP events. Production
  logs showed every ChatGPT tool call starting with an HTTP 400, then a legacy initialize,
  which matches a dual-era client probing the 2026-07-28 revision and falling back.
  The owner asked to implement the MCP specification first and to make errors observable.
outcomes:
- Remote MCP serves 2026-07-28 requests statelessly (server/discover, per-request
  metadata and transport headers, resultType, cacheable list/read results) while the
  initialize-based 2025 revisions keep working unchanged.
- 2026-07-28 clients can receive shared-state hints through subscriptions/listen
  on the POST response stream; legacy clients keep resources/subscribe and the GET
  stream.
- Version and header failures return the specification's JSON-RPC errors, so a dual-era
  client stays on the modern revision instead of falling back.
- Each request log line names the bounded MCP version, method, tool, client and error
  code, and unexpected failures name only their error class, without arguments, content
  or credentials.
scope:
- lib/mcp/**
- lib/server/node/server.ts
- lib/server/node/mcp-event-stream.ts
- tests/application/**
- tests/postgres/**
- scripts/testing/verify-node-built.mjs
- skills/action-tools/**
- ARCHITECTURE.md
- docs/technical/mcp-api.md
- docs/technical/infrastructure.md
non_goals:
- Webhook or callback Events, still an unaccepted MCP working-group proposal.
- tools/prompts/resources list-change notifications, MRTR input requests, the Tasks
  extension or Mcp-Param headers.
- Moving the standalone local consumer to 2026-07-28.
- Longer streams than the existing Cloud Run request timeout allows.
- Any business data, migration or Gate change.
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261030-mcp-stateless-protocol/requirements.md
  required: true
- role: implementation
  path: changes/change-20261030-mcp-stateless-protocol/implementation.md
  required: true
- role: verification
  path: changes/change-20261030-mcp-stateless-protocol/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- type: references
  target: change-20261029-proposal-selection-events
source_paths: []
summary: Dual-era Remote MCP with server/discover and subscriptions/listen, specification
  error codes, and bounded protocol fields in request logs.
---

## Summary

On 2026-10-30 the owner relayed that ChatGPT said no tool can subscribe to MCP events. That is accurate: subscription is a client protocol operation, not a tool. Investigation of production request logs from 2026-10-27 showed each ChatGPT tool call as four POSTs: 400, then a legacy `initialize`, `notifications/initialized` and the tool call. The 400 came from Weave rejecting an `MCP-Protocol-Version` outside the 2025 revisions with a non-JSON-RPC body; under the 2026-07-28 backward-compatibility rules such a body tells a dual-era client to fall back to `initialize`. The request bodies were not logged, so the probed version is an inference. After falling back, the client never subscribed or opened the GET stream.

The 2026-07-28 revision removes `initialize`, sessions, the GET stream and `resources/subscribe`, and replaces them with per-request metadata, `server/discover` and `subscriptions/listen`. Supporting it lets dual-era clients stay modern and offers them the listen stream. Whether ChatGPT then listens, or delivers hints to a model, is unknown and must be observed after release. The owner also asked that errors be observable: the 400s carried no method, version or cause in logs.

Tool and resource descriptions no longer tell every model to subscribe; they say a client that supports resource notifications can subscribe, and otherwise reads again when resuming.

## Closure Notes
