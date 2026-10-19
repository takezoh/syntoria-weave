---
change: change-20261019-dcr-only-mcp
role: verification
---

# Verification

## Reference contracts

Registration follows [RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591), including the separation between registration and authorization and the untrusted nature of client metadata. Native callbacks follow [RFC 8252](https://datatracker.ietf.org/doc/html/rfc8252). Protocol handling remains in the installed maintained provider and OAuth client libraries.

## Technical probe

An isolated HTTP probe against installed oidc-provider 9.12.2 registered web HTTPS and native loopback public clients through its built-in endpoint, receiving HTTP 201 without a client secret. Client adapter upsert received no expiresIn, demonstrating that the existing expiry-only Firestore adapter could not persist DCR clients. This was a protocol/configuration probe using an in-memory adapter, not Firestore or hosted acceptance.

## Executed evidence

- PostgreSQL migration and transfer suites: 5 passed, no failures, skips or TODOs. The fixture seeds an applied schema with business data, a subject and a fixed-client grant, migrates forward, then verifies subject/data/receipts/replay/user isolation and absence of the client-grant table. Version 3 transfer preserves decoded state and rejects version 2.
- Actual integration: `FIRESTORE_EMULATOR_HOST=127.0.0.1:55435 GATE_TEST_ROOT=../syntoria-gate TMPDIR=$PWD/.local/test-tmp node --import ./scripts/testing/register-loader.mjs scripts/testing/verify-gate-integration.mjs` passed. It uses real oidc-provider, Firestore Emulator, Node HTTP/MCP and PostgreSQL. DCR native registration, approval, code exchange, refresh, bearer write/replay/Undo, disabled-subject rejection and connection revocation passed. The actual standalone openid-client consumer also registered, exchanged, refreshed and reused its persisted registration after disconnect. Browser shared-session reuse, CORS/CSRF, resource boundaries and proposal-independent API behavior remained covered.
- Final Weave `pnpm check`: lint, typecheck and 561 tests passed, with no failures, cancellations, skips or TODOs. `pnpm build` passed, including server, SPA, standalone consumer and 12-file template package verification. `pnpm test:node:built` passed against real PostgreSQL after the final SDK source synchronization.
- Final Gate `npm run check`: typecheck/build and 69 tests passed. Its provider/Firestore Emulator suite passed (one aggregate test covering web/native DCR, invalid input, persistence, approval, refresh, revocation, cross-instance rate/total quotas, variable native port and rejected host/path changes). The rate-window regression rejects a stale clock after a newer window and admits the next window, without resetting the counter backwards.
- The actual full integration command above passed again against the final Gate rate-window fix. The maintained consumer reused its persisted registration across refresh/disconnect/reconnect.
- Independent code review approved the corrected candidate. The initial native-port mismatch and quota-test import findings were repaired and exercised. A further rate-window review approved monotonic transaction behavior. A nonblocking current-document mapping phrase was corrected. These are code-review outputs, not a claim that all formal development-loop lifecycle gates completed.

## Evidence identity

[Local integration evidence](evidence/local-integration.json) records both repository base commits, dirty-source file digests, built artifact digests, exact test totals, stdout digests and the actual integration boundary results. These are local working-tree candidates, not a hosted release. A scope query flagged only the two personal image files already untracked before this work; they remain untouched and excluded from the change.

## Limitations

Actual ChatGPT, Claude Code and Codex connections, external GitHub authentication, Cloud Run, hosted Firestore and Neon are not established by local tests. No production deployment has been performed for this change. Formal design runtime submission encountered readonly-world-changed after concurrent change-package creation; the design candidate was inspected as a contract, not claimed as an independently accepted runtime result.
