---
change: change-20261030-collaboration-view
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

Local working tree on 2026-10-30 on top of `2cdb1cd`; not committed or deployed.

- `tests/ui/navigation.test.mjs`: Collaboration lists only Actions with collaboration records, hides a deferred one until deferred Actions are shown, ignores unlinked records, offers the usual display choices and lists nothing without collaboration data; `documentTitle` puts the waiting count before the view name and falls back for an empty heading (FR-002, FR-006).
- `tests/ui/collaboration.test.mjs`: every record state maps to its status kind; the row shows the most urgent status with its label and the proposal count, is muted for a completed Action and changes the row signature (FR-004). On the generated widget the Inbox row shows the accent proposal icon, the Collaboration rail badge and the title read `1 waiting on you` and `(1) Inbox`, the Collaboration view lists the Action, approving from its details sends one exact-revision write and the row then shows the requested clock (FR-001, FR-005, FR-INV-001). Suggested work without an Action appears above the Collaboration list with its adoption choices and is hidden in Inbox and Flagged (FR-003).
- `tests/ui/dom.test.mjs`: the widget lands on Inbox with no Now view, capture box or rail entry, titles the document `Inbox` and `Flagged` without Action text when an Action is open, and loads recent changes from a list view; marking reviewed in Changes is kept and a later connection save raises the Changes badge while Inbox is shown (FR-001, FR-005, FR-006).
- `tests/ui/web-session-relay.test.mjs` on the actual shell: the shell advertises `title`, shows the configured name before any view, composes `(1) Inbox · Example Actions` and rejects empty, control-character and overlong titles (FR-006, FR-007). `tests/harness/runtime-config.test.mjs`: `appName` is optional and rejects empty, padded, overlong, control-character and non-string values (FR-007).
- `pnpm build` copies `favicon.svg`, `favicon-32.png` and `apple-touch-icon.png` into `dist/spa`; both shell pages link them (FR-008). The 32 px and 512 px renderings were inspected in headless Chrome.
- Screenshots of the generated widget with a synthetic in-page host in headless Chrome at 1280 and 390 px showed the Collaboration view with a suggestion card and proposal, running, reply, result and alert icons.

## Repository gates

- Final `pnpm check`: lint, typecheck and 687 tests passed, with no failures, cancellations, skips or TODOs.
- `pnpm build` passed, including the plugin artifact verification.

## Limitations

Tab titles and favicons in real browsers, the iOS home-screen icon, ChatGPT rendering and authenticated hosted behavior are unverified. The operator input must gain `appName` before the next SPA release for the tab to carry the product name.

## Production release

On 2026-10-30, source `e6d3302`, pushed to main as a fast-forward, was released as revision `weave-api-collab-e6d3302` with image `sha256:6e9b89a38df719da87272ac69a817bbb86dda00536f47f98e531590477561180` (Docker Buildx, linux/amd64). The image and SPA were built from a detached worktree of the commit, where `pnpm check` (687 tests), `pnpm build` and `pnpm test:node:built` passed again, because the shared working tree held unrelated uncommitted edits. See the [release evidence](../../evidence/20261030-collaboration-view-release/release.json).

- The new revision passed its startup schema check and a no-traffic tagged liveness and readiness probe before receiving 100% traffic; the tag was removed. No schema change: the migrator and backup jobs were neither run nor updated.
- Public checks after the switch: readiness 200, MCP with an invalid bearer 401 with a challenge, an untrusted-origin preflight 403, the SPA-origin preflight 204 with its exact origin and credentials, protected-resource metadata 200, an unauthenticated session 401. The new revision logged only those probes' expected 401 and 403.
- The static SPA is version `7b9e8b00-e5e0-4c88-9796-6be7ce7222e5`, rendered with the optional `appName`. All ten public files, including the three icons, matched the candidate hashes with the expected cache, framing and credentialed CORS headers ([asset manifest](../../evidence/20261030-collaboration-view-release/asset-manifest.json), [public checks](../../evidence/20261030-collaboration-view-release/public-verification.json)).

Not verified in production: authenticated Web UI behavior in a real browser (Collaboration view, status icons, Inbox landing, tab title and favicon), ChatGPT widget rendering, and the nightly backup, which remains blocked until the backup role can read `state.client_names`.

