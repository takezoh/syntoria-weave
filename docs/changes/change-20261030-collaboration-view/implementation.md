---
change: change-20261030-collaboration-view
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

- `model/navigation.ts`: `collaboration` replaces `now`; it uses the ordinary display filter plus membership in the snapshot's collaboration `action_id`s. `REVIEW_VIEWS` is only `changes`. `documentTitle` builds the window title.
- `model/collaboration.ts`: `collaborationStatusKind` and `actionCollaborationStatus` replace the proposal count and blocking label; `projectCollaborations` takes a scope (`all`, `attention`, `suggestions`).
- `model/ui-projections.ts`: one icon-only collaboration badge with tone; `model/icons.ts` adds the rail and status icons.
- Removed: `components/now-panel.ts`, `model/now.ts`, the controller's capture write, the capture view state and the capture argument of `hasUnsavedChanges`, and the Now styles.
- `effects/dom.js`: the suggestions panel, the Collaboration rail badge, `setTitle` with `web/title` when the host offers `title`, Inbox landing, and recent changes synced on every confirmed revision. `effects/host.ts` and `model/display.ts` record the `title` capability.
- `web/client.ts` advertises `title`, validates `web/title`, reads optional `appName` and composes the tab title. `scripts/deployment/runtime-config.mjs` validates `appName`; `scripts/render-runtime-config.mjs` renders it.
- `web/public/` holds `favicon.svg`, `favicon-32.png` and `apple-touch-icon.png`, linked from `web/index.html` and `web/auth-return.html`.
- The widget's local `get_selection_context` output schema lists the view kind `collaboration` instead of `now`; no Remote MCP or HTTP contract changes.
