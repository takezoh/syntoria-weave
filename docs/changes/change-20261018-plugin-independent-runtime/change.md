---
id: change-20261018-plugin-independent-runtime
kind: change
title: Distribute shared UI resources without Sites runtime compatibility
status: closing
created: '2026-10-18'
profile: sdd@1
intent: Use the independent authenticated service and one shared UI in the SPA and
  a distributable local MCP plugin, with no Sites runtime fallback.
outcomes:
- The standalone local MCP forwards authenticated operations and serves the same UI
  as the SPA.
- Sites runtime and fallback paths are removed; D1 remains an isolated adapter.
- The portable plugin runs without the source checkout or node_modules and excludes
  private settings and tokens.
scope:
- app/
- lib/
- build/
- scripts/
- tests/
- web/
- plugins/
- skills/
- db/
- docs/technical/
- docs/development.md
- docs/design/
- ARCHITECTURE.md
- AGENTS.md
- README.md
- INSTALL.md
- package.json
- pnpm-lock.yaml
- tsconfig.json
- eslint.config.mjs
- vite.config.ts
- next.config.ts
- postcss.config.mjs
- .gitignore
- .dockerignore
- .github/
- .npmrc
- Dockerfile
- cloudflare-env.d.ts
- pnpm-workspace.yaml
- .openai/
- SITES-SOURCE.md
- docs/usage/
- docs/note/note-20261003-tool-discovery-and-caller-guide-skills.md
non_goals: []
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261018-plugin-independent-runtime/requirements.md
  required: true
- role: implementation
  path: changes/change-20261018-plugin-independent-runtime/implementation.md
  required: true
- role: verification
  path: changes/change-20261018-plugin-independent-runtime/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- {type: modifies, target: design-assistance}
- {type: modifies, target: design-action-state-and-perspectives}
source_paths: []
summary: Retire Sites composition, retain an isolated D1 adapter, and deliver the
  shared SPA UI through a local OAuth MCP plugin.
updated: '2026-10-18'
---

## Summary

The independent service is the only live persistence authority. The distributable OAuth MCP consumer serves the shared SPA UI and forwards exact authorized operations. Sites execution paths and fallbacks are removed; D1 remains a standalone tested adapter.

## Closure Notes

Implementation, independent re-review, full checks, build, frozen dependency installation, real PostgreSQL/Node and fresh-package verification are complete. Actual client installation/UI acceptance is external and unexecuted. Formal document closure is pending a pre-existing conformance-tool exception documented in verification.
