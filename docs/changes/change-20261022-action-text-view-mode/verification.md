---
change: change-20261022-action-text-view-mode
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

Local evidence on 2026-10-22, uncommitted working tree:

- `pnpm check`: lint and typecheck passed; 576 tests passed, 0 failed/cancelled/skipped/todo.
- `pnpm build`: exit 0, including plugin artifact verification.
- New tests: `tests/ui/rich-text.test.mjs` (parser structure, unsafe destinations, bounded pathological input, memoization), view-state/controller normalization, inspector text projection, DOM flows (view rendering, retained nodes, host link request and failure message, Edit/Done flush once, IME-deferred Done, invalid Title, creation through identity confirmation) and the SPA relay `ui/open-link` handling.
- Existing DOM tests that edit Title/Notes now enter Edit first; a temporary instrumentation pass confirmed no test types into hidden inputs.
- Local Chromium (Playwright, mock host, not committed) at 320/390/1280 px in light and dark: no horizontal overflow, focus on toggle/title as specified, link sends `ui/open-link` without navigation or popup, Done saves one notes edit, and a new Action stays in edit mode through creation.

Not verified: actual ChatGPT host support for `ui/open-link`, device IME behavior, and deployed resource caching.
