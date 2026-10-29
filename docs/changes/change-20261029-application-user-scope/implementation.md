---
change: change-20261029-application-user-scope
role: implementation
---

# Implementation

User isolation is enforced by verified Principal capabilities and explicit SQL user predicates, inserted user IDs and user-composite conflict keys. Composite keys and foreign keys remain database integrity constraints. Ordinary store transitions, CAS, replay, retention and authentication are unchanged.

Remove transaction-local app.user_id settings from store, subscription and transfer adapters. Remove export-policy creation and the pg_dump row-security option. Retain table privileges and separate administrative entry-point checks.

Add 0009_application_user_scope.sql: disable and unforce RLS, remove state policies, ensure metadata exists and repair retained action and collaboration deltas with the historical Unicode-preserving scanner. Existing SQL migration files are unchanged. The migration runner skips unapplied 0007_action_metadata_text.sql only when its explicit successor is present; already recorded migration checksums are still verified. Startup accepts either historical journal shape only after 0009 and rejects active state-table RLS.

A fenced production upgrade must migrate and apply table grants before switching API and backup artifacts. No BYPASSRLS change is needed. The prior deployment request remains pending until the corrected artifact is deployed and verified.
