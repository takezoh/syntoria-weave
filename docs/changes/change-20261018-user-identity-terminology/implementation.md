---
change: change-20261018-user-identity-terminology
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

## Content

The application port is `UserActionStore`; verified identities, composition functions, principals and adapter parameters use `user`. PostgreSQL migration `0002_user_identity.sql` renames eight columns and replaces business RLS policies with transaction-local `app.user_id`. PostgreSQL dependencies retain their keys, references and indexes. Readiness requires both migration journal entries; a service built for the changed schema must not serve the first schema alone.

The advisory lock uses the unchanged version-1 namespace. Historical D1 SQL and its mutation lint fixtures retain physical column `owner` and bind the verified `user`. Applied migration checksums are unchanged. Transfer manifests use version 2 with `user_id` columns and reject other formats; no compatibility aliases are accepted. Administrative identity grant manifests now use `user`.

The Lore repository is handled separately; its versioned signed payloads require explicit codecs rather than replacement of serialized bytes. Cross-repository progress is not evidence of a deployed Gate service.
