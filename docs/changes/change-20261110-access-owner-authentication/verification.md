---
change: change-20261110-access-owner-authentication
role: verification
---

# Verification

Local verification covers signed assertions through real PostgreSQL, owner
binding, wrong-audience rejection, browser CSRF, person/AI distinction, replay
and admission revocation. The full pnpm check suite and build are required.
A separate browser relay test covers Access reauthentication without Gate calls
and retention of the mounted workspace. Migration regression fixtures include
NUL and unpaired UTF-16 surrogates. Local verification does not establish hosted
Cloudflare login, API Gateway forwarding, Neon migration or client acceptance;
keep those operational records outside the tracked repository.

Completed local checks: `pnpm check` passed 766 tests with no failures, skips,
TODOs or cancellations, including PostgreSQL migration and signed-assertion
coverage, shared-actor events and the local OAuth-only code/refresh flow.
`pnpm build` produced the API, browser and local-client artifacts. Terraform
formatting and `terraform validate` passed with no infrastructure apply.

The Access-protected runtime-config regression was corrected after the full
suite: the shell now sends same-origin credentials when fetching its protected
configuration. All four browser relay tests, typecheck and the build passed after
that correction. The earlier fixture ignored credential mode and therefore did
not model Access rejecting a request without its cookie; the revised fixture
requires the cookie-bearing fetch mode before it returns configuration.

Structural documentation lint passed. Repository-wide conformance did not return
a verdict: the validator crashes on existing prose strings in forbidden-boundary
lists. This is recorded in [the separate tooling issue](../../issue/issue-20261110-conformance-crashes-on-historical-forbid.md).
No conformance success is claimed.
