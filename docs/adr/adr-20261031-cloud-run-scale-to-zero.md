---
id: adr-20261031-cloud-run-scale-to-zero
kind: adr
title: Scale the production API to zero when idle
status: accepted
created: '2026-10-31'
decision_makers:
- user
tags: []
owners: []
relations:
- {type: references, target: adr-20261018-backend-contracts}
source_paths:
- infra/cloud-run/production.json
- docs/technical/infrastructure.md
- infra/main.tf
summary: Production API minimum instances change from 1 to 0; Neon no-autosuspend
  is unchanged.
updated: '2026-10-31'
---

# Scale the production API to zero when idle

## Context

[Backend contracts](adr-20261018-backend-contracts.md) chose a warm production API instance (NFR-003 in the [infrastructure change requirements](../changes/change-20261018-cloud-run-neon-infrastructure/requirements.md)) to reduce idle-start delay. No API cold-start measurement supported that choice.

Minimum instances were set on the revision template, so every tagged no-traffic verification revision also kept an idle instance. On 2026-10-29 to 2026-10-31 this held two to three idle API instances, billed at the min-instance idle rate, while tagged revisions served no requests.

Every API and MCP request also introspects credentials online with Gate, which scales to zero. After idle periods the first request still waits for a Gate cold start, so a warm API instance did not remove idle-start delay.

## Decision

The production API uses minimum instances 0 and request-based billing, and scales to zero when idle. Maximum instances, concurrency, timeouts and connection budgets are unchanged. Neon no-autosuspend is not changed by this decision.

This replaces only the warm API instance part of the backend contracts decision.

## Consequences

- Positive: no API compute is billed while idle, and tagged verification revisions no longer hold idle instances.
- Negative: the first request after idle includes an API cold start in addition to any Gate cold start.
- Neutral: cold-start p95 remains a measured release objective; it is not established by this decision.

## Confirmation

`infra/cloud-run/production.json` sets `autoscaling.knative.dev/minScale` to `0`, and `infra/main.tf` sets the API `min_instance_count` to `0`. A `gcloud run deploy` revision inherits the service template, so later revisions keep minimum instances 0 unless a deployment sets it explicitly. On 2026-10-31 production moved to a configuration-only revision with the unchanged image and minimum instances 0; the two tagged no-traffic revisions were removed. Public readiness returned 200 and unauthenticated MCP returned 401 with the protected-resource challenge. Cold-start latency was not measured.
