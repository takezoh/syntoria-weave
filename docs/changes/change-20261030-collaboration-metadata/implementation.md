---
change: change-20261030-collaboration-metadata
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

- `lib/data/types.ts`: `Collaboration.metadata`.
- `lib/domain/collaboration.ts`: `collaborationMetadata` validates the text with the shared description limit and keeps the saved value when omitted; `createCollaboration` takes it, `transitionCollaboration` accepts `metadata` for every command through the shared `next` record, and `persistedCollaboration` requires it.
- `lib/application/collaboration-service.ts`: `propose_collaboration` and `adopt` accept it; other commands pass the payload to the domain.
- `lib/mcp/collaboration-definitions.ts`: `metadata` in both schemas; the proposal, `summary` and `remaining` describe Markdown rendering.
- `db/postgres/migrations/0012_collaboration_metadata.sql` splices `"metadata":""` in front of existing serialized bodies, as 0011 did for `delegation`; `lib/adapters/postgres/migrations.ts` expects it; `lib/adapters/postgres/transfer.ts` moves to version 10.
- The UI needs no change: cards render parsed human-facing fields only, and the handoff names the fields it copies.
- Documentation: data model, MCP API, deployment rollout, assistance design and both Skill references.
