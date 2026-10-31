---
id: note-20261031-action-search-production-deployment
kind: note
title: Action search production deployment
status: draft
created: '2026-10-31'
tags: []
owners: []
relations:
- {type: references, target: change-20261031-action-search}
source_paths: []
summary: API and SPA deployed from the approved search source; public verification
  passed, authenticated acceptance remains unverified.
---

## Summary

The user requested deployment of the approved Action search. Source `87aa3e133a6e52a6f7ca26d9f12087dfb2f36cae` was built into an immutable API image and a matching static SPA. The migration job completed without a schema change. The API candidate passed startup checks and traffic advanced from zero to 10%, then 100%. The previous revision was retained. Independent static SPA publication also completed.

Deployment is complete, but full release acceptance remains incomplete: the verification browser has no authenticated session, and authenticated HTTP/MCP and actual ChatGPT resource retrieval/cache behavior were not verified. No production Action data was written for acceptance.

## Verification and evidence

The implementation's full check passed 738 tests, lint and typecheck. The release reran the build and built Node/PostgreSQL process acceptance successfully, and built the container from a clean Git archive. No push, merge, data reset or unrelated source change was performed.

After the final traffic switch, public HTTPS retrieval matched all 11 published content paths against the candidate SHA-256 manifest. Runtime configuration was no-store, hashed assets had immutable caching, and document/workspace framing headers matched their separate contracts. API readiness returned 200, unauthenticated session and MCP requests returned 401, and credentialed CORS preflight returned 204 with the exact SPA origin. The new API revision had zero error log entries at the bounded post-switch observation. The public browser displayed sign-in; that is not authenticated search acceptance.

Deployment identifiers, service/configuration and secret-version readbacks, image digest, provider version, migration execution, file hashes and public verification details are retained under ignored `.local/search-release/`. They are intentionally absent from this tracked record. [Implementation verification](../changes/change-20261031-action-search/verification.md) records the prior local browser and independent review evidence.
