---
change: change-20261029-operation-provenance-retention
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

`lib/data/model/storage.ts` owns the policy (`OPERATION_HISTORY`), the cutoff (`operationRetentionCutoff`) and the pure prune boundary (`operationPruneThrough`): everything at or below max(head-5000, min(head-100, r-1)) is removed, where r is the oldest retained revision committed at or after the cutoff. The PostgreSQL store finds r with an ordered scan of the user's revision index that stops at the first recent operation, compares canonical ISO instants bytewise (`COLLATE "C"`), and deletes the prefix in the commit transaction. The D1 adapter expresses the same bound in one batch statement; the memory fake calls the pure function.

Migration `0005_operation_client_provenance.sql` adds nullable `state.operations.client_id` with a length check. The PostgreSQL store inserts the verified principal's `clientId`; D1 and the memory fake return null. `RetainedOperation` and `ChangeOperation` carry `client_id`, and projection rejects malformed values. The runtime schema check expects 0005, and the transfer format is version 4 with the new column; version 3 is rejected.

Migration `0006_operation_actor_kind.sql` adds nullable `state.operations.actor_kind` (`user` or `client`). Authentication sets `Principal.actorKind` from the credential: a browser session is `user`, a bearer token is `client`. The PostgreSQL store records it. `RetainedOperation` and `ChangeOperation` carry it, and projection rejects other values. D1 and the memory fake return null. The runtime schema check expects 0006, and the transfer format moves to version 5; version 4 is rejected. A change made inside an AI host's embedded UI arrives through that host's connection and is recorded as `client`; Weave cannot verify a click there.

Assistance policy, the `operation_status` and `get_changes` tool descriptions, the skills and current documents describe the new retention and provenance.

## Release impact

Apply migration 0005 before starting the new image. The previous image's startup schema check rejects the 0005 schema, so after the migration a rollback needs a forward fix or a new image, not the previous image. Running previous instances keep working because their inserts do not name the new column. Existing operations keep NULL `client_id`. Pruning under the new policy starts at each user's next write; histories longer than 100 are not restored. Transfer files must be exported and imported by the same release (version 4).
