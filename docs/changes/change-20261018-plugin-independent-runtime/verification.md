---
change: change-20261018-plugin-independent-runtime
role: verification
---

# Verification

## Final source and artifact

- Node.js 24.16.0 and pnpm 11.25.0.
- Final `pnpm check`: 551 passed, 0 failed/cancelled/skipped/TODO; lint and typecheck passed. This includes standalone D1 contracts, actual Node HTTP/MCP/PostgreSQL, public OAuth consumer races and remote forwarding.
- `pnpm test:node:built`: passed after final build; real PostgreSQL, API-only routes, sessions/CSRF, duplicate-header rejection, write/replay, bearer MCP, revocation and outage checks.
- `pnpm build`: passed; produces the API, static SPA, self-contained local MCP and `dist/plugin` with its hashed inventory, licenses, UI and complete operation skill.
- `node scripts/testing/verify-local-mcp.mjs`: passed after the final build. A fresh copied package runs without repository/node_modules, preserves JSON-RPC stdout, strips inherited secret variables, accepts host-only `PLUGIN_DATA`, and serves byte-identical SPA/resource HTML.
- Frozen installation with the ordinary supply-chain/build-approval policies passed. Validation uses an explicit cache location shared by sandbox and host: `CI=true TMPDIR=... pnpm install --frozen-lockfile --store-dir /home/dev/.cache/action-tools-pnpm-store`. No new package resolution versions were introduced; the package graph decreased from 942 to 538 records. The retained TypeScript lint implementation remains 8.59.3.
- Ordinary documentation schema/content/reference lint: passed, 81 indexed documents. Current architecture, install/update docs, skills and active design facts reflect the independent service and local consumer.

## Boundary evidence

Focused OAuth/MCP tests pass 8/8: exact root issuer, PKCE callback/wrong-state, redirects, port conflict, private SQLite state, concurrent processes, disconnect generations, exact remote results/errors, unknown write without retry, 401 conditional invalidation/newer authorization preservation and distinct 403 denial. The PostgreSQL consumer harness exercises real Node sockets and the production adapter for write/replay/Undo/user isolation. OAuth identity exchange is synthetic.

Independent review initially requested two corrections (host data-path propagation and reconnect after token rejection); both were fixed and independently approved. The local-consumer loop reached `SUCCEEDED` / `all-required-current` before root documentation/dependency integration. Runtime retirement separately passed check/build/built-Node tests; its formal invocation failed on ancillary mutation scope and is not claimed successful. Root expanded and reviewed those integration paths.

## Failures found and corrected

A first focused correction run rejected a valid JSON-RPC success result; the wire predicate was fixed and the suite passed. Final clean installation revealed a hidden Next.js parser requirement in the inherited lint preset. Direct use of the same maintained TypeScript lint implementation removes that dependency, and all final checks pass.

Offline installation lacked package metadata; sandbox registry access failed with EAI_AGAIN. Network-enabled installation succeeded without bypassing supply-chain policy. Sandbox/host package-store defaults differed; an explicit cache path resolved that environment mismatch. Temporary-area quota interrupted sandbox startup; removing only regenerable Node compilation cache restored it. Historical acceptance artifacts and personal settings/data were preserved.

## Remaining external boundaries

Actual plugin installation, client resource caching/rendering and host lifecycle have not been accepted. Synthetic OAuth and local PostgreSQL do not prove real GitHub login, hosted Neon, Gate/Firestore or a particular client. This source/package change performs no production deployment or personal business-data writes.

The documentation tool's conformance command crashes on pre-existing string boundary entries (`AttributeError: str has no attribute get`). Ordinary schema/content/reference checks pass; formal conformance/closure is not claimed. Root used the canonical documentation parser/serializer for nested metadata because the patch CLI supports only top-level scalar/list values.

The scope-evidence query reports only the pre-existing untracked `IMG_1875.PNG` and `IMG_1876.PNG` as outside this change. They are neither modified nor staged. All implementation paths are declared; no test-member gaps were reported. The evidence tool cannot resolve the extensionless Dockerfile declaration, whose source is restored unchanged from the baseline.

## Installation documentation and skill correction

The follow-up separates MCP client setup from ChatGPT installation, restores README's Work installation prompt and adds the installation workflow skill. Content/reference and skill-frontmatter validation cover these documentation-only changes; the earlier application-suite result is not a new ChatGPT installation claim. The documented renderer inputs, required config.json fields, strict connection-tool arguments and stdio launcher match code. Actual ChatGPT installation remains unexecuted.
