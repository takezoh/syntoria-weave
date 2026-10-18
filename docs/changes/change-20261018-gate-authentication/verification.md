---
change: change-20261018-gate-authentication
role: verification
---

# Verification

Local verification uses real PostgreSQL 17 and a synthetic HTTPS introspection/token endpoint. This establishes the actual Gate verifier path and PostgreSQL session behavior, not hosted Gate, GitHub or client-host acceptance. Tests cover request-by-request introspection, invalid/expired/wrong-audience credentials, explicit local grant revocation, Web CSRF/Origin, encrypted tokens, serialized rotating refresh, outage rejection, connection revocation, cross-connection independence, write/replay and user isolation.

Executed successfully on the candidate source: `pnpm check` (557 passed, zero failed/skipped/cancelled/TODO), `pnpm build`, and `pnpm test:node:built` (real built Node process, HTTPS Gate fixture, real PostgreSQL, session/CSRF, write/replay, resource and revoked-cookie rejection). The focused PostgreSQL suite also passed before the final broader checks. Hosted acceptance remains open until Gate/Firestore and Cloud Run/Neon are exercised with real authorized credentials. No deployment is implied by local tests.

The bundled verifier matches `../syntoria-gate/packages/sdk/src/index.ts` byte-for-byte at SHA-256 `727f18e789ab5f86751b00539d97f18e96ec86753afac6510ca0557d74b726ec`. Both source copies were hashed directly after verification.

Documentation lint passed for 80 indexed documents without warnings; all local link targets in the 12 touched Markdown documents exist. Conformance checking could not complete: the installed dev-docs runtime raised `AttributeError: 'str' object has no attribute 'get'` in `change_lifecycle.conform_repo`. Terraform formatting/validation was not executed because the `terraform` executable is unavailable in this environment. These are explicit unexecuted checks, not passes.

Actual Gate boundary verification also passed with `FIRESTORE_EMULATOR_HOST=127.0.0.1:55435 node --import ./scripts/testing/register-loader.mjs scripts/testing/verify-gate-integration.mjs`. This run used Gate's real `oidc-provider`, Firestore Emulator and actual Weave public OIDC/SDK clients with a real PostgreSQL adapter. Verified real authorization-code/PKCE/ID-token interoperability over HTTPS, explicit approval, Web cookie access, encrypted rotating refresh with concurrent requests, write/replay without duplicate SQL rows, connection revocation producing Web 401, and survival of an independently approved MCP connection. Only GitHub's external exchange was injected at its test port; no hosted GitHub acceptance is claimed.

Reproducible command, source hashes and concrete boundary assertions are saved in [local Gate integration evidence](evidence/local-gate-integration.json). After adding the integration harness and product-prefixed infrastructure configuration, `pnpm check` passed again (557 tests, zero skipped/TODO/cancelled), `pnpm build` passed, and the real Gate integration command passed again against the final harness source. Runtime authentication source was unchanged by the resource naming update.

## Hosted cutover

Production Gate GitHub login completed with callback 303 and authenticated Connections 200. All 635 source D1 rows were imported under a persistent source write fence: 3 projects, 9 tags, 84 actions, 211 action-tag links, 1 perspective, 227 identity markers and 100 retained operations. All normalized field hashes match the transfer, including canonical requests, results and deltas. The original internal user identity is preserved and explicitly bound to the allowed GitHub subject for the registered Web/MCP clients. The post-import private backup execution `weave-backup-hfzpp` succeeded. See [transfer equality](evidence/production-transfer-equality.json).

The production Neon runtime role passed isolated-user replay, concurrent revision competition, Undo and user isolation checks; synthetic rows were removed. See [hosted adapter evidence](evidence/hosted-neon-adapter.json). Weave revision `weave-api-00003-vcb` enables writes with a fresh cursor epoch; readiness and Web return 200, unauthenticated session and MCP return 401. Source writes remain fenced. The optional temporary loopback MCP diagnostic did not complete and is not a prerequisite for normal Web use. Actual browser Weave login/data display and a real MCP client remain separate acceptance checks.

The `weave-nightly-backup` Scheduler is enabled at 18:00 UTC daily using `weave-scheduler`, whose invocation permission is limited to `weave-backup`. Infrastructure and deployment references are recorded in [production preparation](evidence/production-preparation.json).

## Shared-session static-host preparation

The assets-only Cloudflare service `weave-web` was deployed as version `1013a865-c235-450d-b50a-1d78433d5e17`. All seven published HTML, JavaScript and runtime-configuration files returned HTTPS 200 and matched the rendered local bytes. Runtime configuration returned `Cache-Control: no-store`; all hashed JavaScript assets returned immutable caching. The root document uses a static rewrite to `index.html`. This verifies deployed static delivery, not authenticated UI behavior.

Candidate revisions `gate-api-shared-session-20261018` and `weave-api-shared-session-20261018` are deployed with zero normal traffic. Their immutable image digests are respectively `sha256:9173dec981dd49e2288f778dbe993982bb4040476916c99fecc7b062e851f4e6` and `sha256:cc4ee076081a79fd87bafd629c709edde207aca65a708e0171626667248f50de`. Both readiness probes returned 200 against actual Firestore/Neon. The candidate API keeps writes blocked. These artifacts include validated uncommitted source; they are not clean-commit release artifacts.

Both standard Cloud Run domain mappings and their DNS-only Cloudflare CNAME records were created. Google-managed certificate issuance remains pending. The new issuer's browser and MCP grants were provisioned to the verified existing internal user without changing action data. All four new ephemeral Gate collections have ACTIVE Firestore TTL policies. The serving revisions remain unchanged while HTTPS, GitHub callback alignment and actual browser/client acceptance are pending. Actual domains and private provider receipts remain in ignored local deployment settings.

## Shared-session production activation

Both API domain certificates were issued and HTTPS readiness returned 200. After correcting the GitHub OAuth callback, the user confirmed successful GitHub login and display of existing actions in the deployed SPA. Before activation, the existing user snapshot remained at revision 227 with 84 actions, 3 projects, 9 tags and 1 perspective. Explicit browser and MCP grants resolve to the same existing user.

Gate serves revision `gate-api-shared-session-restored`. Weave first served the write-blocked shared-session revision, then switched 100% of normal traffic to `weave-api-shared-session-live` with `WRITE_MODE=enabled`. All other environment settings were compared and remained unchanged. Both API revisions resolve to image digest `sha256:0b8f6b94336dfdffb7073c1971e1f6997a1643fea32ad611592b4263837345a8`. Post-switch readiness returned 200, unauthenticated session and MCP requests returned 401, and no ERROR logs were observed for the activated revision at the verification time. Actual URLs, provider receipts and configuration remain in ignored local deployment records.

The hosted Chromium check verified static SPA startup and handling of the real API's unauthenticated response without JavaScript errors. The user's confirmation establishes the real login and existing-data display path. Authenticated writes/replay/Undo through this deployed browser session and actual MCP client acceptance remain unverified; prior local and hosted adapter tests do not substitute for those client checks.
