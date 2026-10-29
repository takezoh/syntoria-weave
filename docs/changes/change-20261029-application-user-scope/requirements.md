---
change: change-20261029-application-user-scope
role: requirements
---

# Requirements

The user explicitly requested application-owned user isolation and removal of PostgreSQL RLS. A verified Gate identity must continue to determine the user; request arguments must not choose one.

- Given two users with identical object or operation IDs, reads, writes, receipts, Undo and change feeds affect only the authenticated user's records.
- Given an existing FORCE-RLS database, a schema-owning NOSUPERUSER/NOBYPASSRLS migrator can upgrade without data reset or a privilege grant.
- Given an already recorded metadata migration, its journal entry and checksum remain unchanged. A pending historical metadata migration is superseded explicitly by 0009.
- Given a migrated database, state tables have no active RLS or row policies. Runtime adapters do not depend on connection-local identity state.
- Backup uses its separate SELECT role. Direct database credentials remain trusted server/administrative access, not an end-user interface.
