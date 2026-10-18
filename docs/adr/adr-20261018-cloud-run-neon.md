---
id: adr-20261018-cloud-run-neon
kind: adr
title: Adopt Cloud Run and Neon for an independent state service
status: accepted
created: '2026-10-18'
decision_makers:
- user
tags: []
owners: []
relations:
- {type: supersedes, target: adr-20261001-sites-d1-work-mvp}
source_paths: []
summary: Select Cloud Run and Neon PostgreSQL; treat ChatGPT as one client integration
  and preserve state contracts during migration.
updated: '2026-10-18'
---

# Independent state service on Cloud Run and Neon

## Decision

The user selected Cloud Run, Neon PostgreSQL, and TypeScript/Node.js on 2026-10-18. Weave is an independent shared-state service with HTTP API, Remote MCP, and a Web UI. ChatGPT plugin support is one client integration, not the product boundary or deployment prerequisite.

Keep Thymesis and Weave independently deployed, with separate databases, credentials, APIs, history and cursors. Reuse operational conventions, not shared business tables or cross-service transactions. Weave does not acquire Thymesis's Curator, queues or scheduled jobs.

## Requirements and rationale

Support actions, original notes, lifecycle, containment, classification hierarchies, ordering, flags, dates, saved perspectives, filtering, consistent snapshots, changes, operation lookup and Undo. Preserve atomic state/revision/receipt/history updates, stale-write rejection, durable commits, identical replay and unknown-outcome recovery. Owner is a data partition and authorization boundary, not a reason by itself to require a relational database.

A relational database is not mandatory. PostgreSQL is selected because its queries, constraints and transactions support these operations with limited additional storage machinery. Document or KV storage would require an independently validated query, concurrency and history design; no measured benefit currently justifies that redesign. Neon aligns database operations with the selected Thymesis baseline. This is not evidence that PostgreSQL or Cloud Run is faster than D1 or Sites.

## Consequences

Replace Sites identity, Worker composition, D1 adapter, build and deployment effects. Reuse pure domain/application logic and shared UI where contracts permit. Concrete OAuth, region, capacity, connection and warm-instance decisions are defined in [backend contracts](adr-20261018-backend-contracts.md). Retain existing data and migration records; never apply the historical reset as a migration strategy.

## Confirmation

Implementation, infrastructure creation, deployment and host acceptance are pending. Follow the [infrastructure design and migration plan](../technical/infrastructure.md). Validate real PostgreSQL transactions, deployed authorization, direct HTTP and Remote MCP, Web UI and each selected host independently. Compare warm and cold latency using equivalent datasets and boundaries.

## Sources

- User direction in this session: adopt Cloud Run and Neon; update documents before infrastructure implementation; treat ChatGPT as one supported integration.
- [Thymesis technical selection](https://chatgpt.com/space/page_b7ebd2c865b48191a5780cd56637a44d): adopted design, not deployment or performance evidence.
- [Existing local timing evidence](../changes/change-20261015-batch-write-context/verification.md).
