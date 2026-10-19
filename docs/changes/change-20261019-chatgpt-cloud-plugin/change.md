---
id: change-20261019-chatgpt-cloud-plugin
kind: change
title: Restore ChatGPT cloud plugin packaging
status: draft
created: '2026-10-19'
profile: sdd@1
intent: Restore the private Syntoria Weave package that requires the host-registered
  Cloud Run/Gate MCP app while retaining the standalone local MCP consumer.
outcomes:
- The plugin manifest requires the exact registered app through .app.json, while mcp.json
  has no duplicate server entry.
- The generic build is visibly noninstallable; a configured private package requires the
  actual host-issued app ID and contains both skills, shared UI and license.
- Marketplace installation, required app connection, tool refresh, new-chat cache refresh
  and actual host acceptance remain distinct observations.
scope:
- plugins/action-tools/
- scripts/
- build/
- tests/
- lib/mcp/
- skills/
- README.md
- INSTALL.md
- ARCHITECTURE.md
- AGENTS.md
- package.json
- docs/
non_goals:
- Production registration/deployment, real host account operations, source UI changes,
  and business-state behavior changes.
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261019-chatgpt-cloud-plugin/requirements.md
  required: true
- role: implementation
  path: changes/change-20261019-chatgpt-cloud-plugin/implementation.md
  required: true
- role: verification
  path: changes/change-20261019-chatgpt-cloud-plugin/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations: []
source_paths: []
summary: Restore the registered-app personal package workflow for the ChatGPT cloud service;
  keep local MCP as a separate consumer.
---

## Summary

## Closure Notes
