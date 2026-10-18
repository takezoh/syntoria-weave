---
change: change-20261018-user-identity-terminology
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

## Content

The authenticated person is called `user` in current contracts, code and documentation. PostgreSQL isolation columns are `user_id`; identity values do not change. Existing records, canonical requests, receipts, revision histories and replay results must survive migration unchanged. Every business query remains user-bound and the runtime role cannot bypass RLS.

Applied migrations, external SQL role/table ownership, DOM `ownerDocument` and fixed cryptographic namespaces keep their established spelling. Historical D1 physical columns remain encapsulated by the D1 adapter. The caller cannot supply either user identity or previous identity field names to override authentication. No live schema mutation or deployment belongs to this change.
