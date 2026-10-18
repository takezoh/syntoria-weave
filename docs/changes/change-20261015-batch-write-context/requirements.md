---
change: change-20261015-batch-write-context
role: requirements
---

# Requirements

Issue [#31](https://github.com/takezoh/syntoria-weave/issues/31) requests non-geographic access improvements. This unit removes one sequential database acquisition per write or replay without changing public responses.

- When a syntactically valid write reaches receipt lookup, the store shall acquire the owner-scoped receipt and complete current state in one consistent read batch.
- The application shall reject a mismatched canonical receipt before decoding the snapshot or allocating IDs.
- Identical replay shall return the original receipt result with current state from that acquisition, without reapplying changes.
- New writes shall retain latest-revision CAS and a fresh post-commit snapshot. Atomic commits, receipt retention, owner isolation, conditional Undo and exact unknown-result recovery shall remain unchanged.
- Ordinary non-Undo writes shall use three sequential database calls, compared with four before this unit; identical replay shall use one, compared with two. These are call-count targets, not hosted latency claims.

Geographic placement, infrastructure, migrations, deployment, UI preview removal, response-shape changes and partial/incremental UI snapshots are outside this unit. The broader Issue #31 remains open.
