---
change: change-20261029-action-collaboration
role: verification
---

# Verification

## Automated coverage

- Pure domain: original text, proposal decisions and versions, run ownership, stale action changes, withdrawal, late/unknown outcomes and explicit reconciliation.
- Real local PostgreSQL: competition, identical replay, durable recovery after ordinary receipt removal, atomic adoption, user isolation, immutable history, transfer and unchanged action lifecycle.
- UI/controller and generated HTML DOM: request retention, conflict/unknown recovery, proposal adoption, decision labels and actual button-to-controller communication.
- Source Node HTTP/MCP with real local PostgreSQL: shared browser/bearer state, CSRF, proposal/adoption/start/report/replay and provenance.
- Built Node process: request/start/report, replay, history and unchanged action lifecycle over authenticated HTTP with real local PostgreSQL.

## Evidence and limits

Final local validation on 2026-10-29: Local tests use a local Gate fixture and PostgreSQL fixture; they do not establish hosted Neon, deployed Gate, installed host UI or external runner acceptance. No deployment, hosted migration, commit or external execution is part of this change.

| Command | Result |
| --- | --- |
| `pnpm check` | Passed: lint, typecheck and 611 tests; zero failed, skipped, cancelled or TODO tests. |
| `pnpm build` | Passed: service, SPA, local MCP and noninstallable plugin template. |
| `pnpm test:node:built` | Passed: real local PostgreSQL, HTTP/session/CSRF, collaboration request/start/report/replay/history, revocation and outage handling. |
| `docs lint` | Passed structural indexing and schema validation. |
| `docs lint --conformance` | Not completed: document tool raises `AttributeError: 'str' object has no attribute 'get'` while reading existing design `boundaries.forbidden` entries. No conformance success or package closure is claimed. |
| `git diff --check` | Passed. |

The package remains active because conformance/closure is not complete. This does not change the implemented feature's local test results. Generated build output and temporary logs are not delivery artifacts. The final implementation has no hosted deployment evidence.
