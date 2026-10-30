---
change: change-20261030-mobile-interaction-ownership
role: verification
---

# Verification

## Integrated source

The candidate integrates remote main at ca724b09ef4331bcbc7556c9398e0abcd9b53c1e. The mobile change does not alter the event webhook backend delivered by that baseline.

## Executed checks

- pnpm check: 738 tests passed, zero failed, cancelled, skipped or TODO; lint and typecheck passed. This includes the repository's local PostgreSQL harness, not hosted Neon acceptance.
- pnpm build: passed; shared widget, SPA, Node service and plugin template generated and verified.
- Chromium integration: five viewport cases (390x844, 459x938, 844x390, 390x420, 1280x844). The harness checks stationary mobile chrome, exclusive Action/Project/Tag headers, independent detail scrolling, Back scroll/focus restoration, browser-dispatched row/whitespace pulls, short-pull and swipe click suppression, cancellation, repeated hold/chooser cleanup, foreground coalescing, retained Refresh control and wide touch hold with a split inspector.
- Pure and DOM suites cover proposal retention, IME gating, unknown-result recovery, wide gesture eligibility and pen release/cancellation outside the List.

## Acceptance boundary

Native iOS Home Screen compositing, physical finger latency, keyboard safe-area behavior and the reported translucent top layer remain unverified on the affected device. Chromium evidence is not a substitute. This package remains active until native acceptance is available. No estimated status-bar height or obscuring band is added.
