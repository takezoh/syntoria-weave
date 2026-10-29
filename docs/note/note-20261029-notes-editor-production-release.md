---
id: note-20261029-notes-editor-production-release
kind: note
title: Notes editor production release
status: draft
created: '2026-10-29'
tags: []
owners: []
relations: []
source_paths: []
---

## Release result

Source `be774a3d28269194e0af94b54174f634f0f450bb` contains the Notes editor height change (`108px` to `240px`) and its DOM assertion. It was pushed to main before building. Existing safe Markdown-subset rendering is retained; stored Notes are unchanged.

The Cloud Run revision is `weave-api-notes-be774a3`, built from image index `sha256:f262aa7d22ef391c52ef9393889fe4659205825c22d1446a88cf010322638170`. The same image completed migration execution `weave-migrator-mjjqc`; no migration files changed. Existing database, identity, secret references and environment configuration were retained. Traffic progressed through 10% to 100%. The previous revision remains available for rollback.

The separate static SPA is version `c06e4014-1665-4313-9e78-feb2e8f17a59`, deployment `58052dea-bc27-4910-89ba-eece59264e3c`. Runtime settings and hosting rules were reapplied to freshly built assets. Public HTTPS retrieval matched every published HTML, JavaScript and runtime-config hash, with no-store configuration and immutable hashed assets.

## Verification and limits

`pnpm check` passed 588 tests without failures, skips, cancellations or TODOs; `pnpm build` and `pnpm test:node:built` passed. Candidate readiness and the migration job succeeded. Canonical-origin readiness, unauthenticated session rejection and credentialed CORS passed during rollout. Candidate error-log queries returned no entries at the recorded observation time; this is a bounded check, not a long-term availability claim.

Chromium loaded the public sign-in page and public workspace assets. At 390 and 1280 px, an isolated synthetic in-browser host verified Markdown rendering, Edit/Done transitions, 240 px Notes height and proposal retention across Refresh. External API calls were blocked and no production data was written. Actual authenticated browser operation and ChatGPT resource/cache behavior remain unverified. The existing narrow-screen overflow measured 408 px at a 390 px viewport, matching the earlier release observation; this change does not claim comprehensive mobile layout acceptance.

## Evidence

- [Source, artifacts and checks](../evidence/20261029-notes-editor-release/release.json)
- [Candidate file hashes](../evidence/20261029-notes-editor-release/asset-manifest.json)
- [Public content and transport checks](../evidence/20261029-notes-editor-release/public-verification.json)
- [Public-asset browser checks](../evidence/20261029-notes-editor-release/browser-verification.json)
