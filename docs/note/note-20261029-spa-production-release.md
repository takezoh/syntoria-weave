---
id: note-20261029-spa-production-release
kind: note
title: SPA production release for Action text view and edit modes
status: draft
created: '2026-10-29'
tags: []
owners: []
relations: []
source_paths: []
summary: Static SPA a72872c published independently of the existing API; records public
  artifact verification and browser acceptance limits.
---

## Release result

The static SPA was published to the existing Cloudflare `weave-web` service at 2026-10-29T05:37:02Z. Deployment `994519dd-d0d5-4abc-8b61-052ba735e7ec` serves version `8db76c28-486f-4186-8c2a-2a4103051c8e` at 100%. Source `a72872c969f60c92f188937d821ad11146634c99` matches the serving API revision `weave-api-actor-a72872c`. The API and database were not redeployed or migrated.

The previously serving SPA version `ab293641-0602-4110-8b20-80f205941680` was deployed on October 18. This establishes that the later API releases had not updated the separately hosted SPA. Its version is retained for rollback; existing domains and access scope were preserved.

## Preparation and verification

- An isolated source archive excluded the main checkout's unrelated uncommitted work. Frozen dependency installation, `pnpm check` (587 passed, zero failed/cancelled/skipped/TODO), `pnpm build` and `pnpm test:node:built` passed.
- After runtime configuration rendering, `_headers` and `_redirects` were reapplied. Assets-only settings retain compatibility date `2026-10-18`, explicit `.html` handling and the root rewrite. The installed Cloudflare CLI validated the build output before upload, then uploaded a candidate version and switched only its deployment traffic.
- Public HTTPS retrieval of `/`, `/index.html`, `/auth-return.html`, `/workspace.html`, `/runtime-config.json` and all three JavaScript assets returned 200 and matched the candidate SHA-256 manifest. Runtime configuration is `no-store`; hashed assets are immutable. API readiness returned 200, unauthenticated session access returned 401, and credentialed CORS preflight returned 204 with the exact SPA origin.
- Chromium verified the public sign-in landing page. At 390 and 1280 px, the public `/workspace.html` opened an existing synthetic Action in View, rendered structured Notes, switched Edit/Done, and retained a proposal through Refresh. These UI checks used an isolated in-browser host with synthetic state and blocked external API requests; they made no production data writes. No page JavaScript errors occurred.

## Acceptance limits

Actual authenticated Gate/browser operation and ChatGPT host/resource caching were not exercised. No existing authenticated browser session was available. Public artifact delivery is verified; authenticated UI acceptance remains unverified and this record does not claim a fully accepted application release. The browser checks also do not claim comprehensive mobile layout acceptance: standalone 390 px testing measured document scroll width 408 px (1280 px measured 1280 px); the earlier strict no-overflow assertion failed before those dimensions were recorded separately. The installed Playwright default browser revision was absent; browser checks used the already installed Chromium 1234 executable without installing a new browser.

## Evidence

- [Release identities and checks](../evidence/20261029-spa-release/release.json)
- [Candidate file SHA-256 manifest](../evidence/20261029-spa-release/asset-manifest.json)
- [Public content, headers and API checks](../evidence/20261029-spa-release/public-verification.json)
- [Chromium behavior checks and limits](../evidence/20261029-spa-release/browser-verification.json)
