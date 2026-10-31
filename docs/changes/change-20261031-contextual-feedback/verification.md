---
change: change-20261031-contextual-feedback
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

## Local source acceptance

- `pnpm check`: passed lint, typecheck and all 748 tests; 0 failures, cancellations, skips or TODOs.
- `pnpm build`: passed Node service, static SPA, standalone local MCP and noninstallable cloud-plugin template build/verification.
- `git diff --check`: passed.
- `docs lint`: passed, with unrelated existing summary-coverage warnings.

The initial 742-test baseline becomes 748: the three obsolete save-status aggregation/message-policy tests were replaced by five typed feedback tests, and four generated-resource DOM tests were added. Existing read-lane and DOM assertions were updated from mixed footer/save-icon semantics to independent typed read state and local recovery. No tests were skipped or disabled.

Pure/controller witnesses cover simultaneous read failure and Action/Catalog drafts; successful refresh retaining Undo and input; stale dismissal and stale displayed Undo callback rejection; pending, failed and unknown Undo; exact replay; receipt-identity clearing; and matching versus unrelated wide inspector placement. DOM witnesses cover unchanged IME nodes/caret, untimed explicit dismissal, Catalog recovery across mobile pages and geometry deferral during a claimed swipe. A MutationObserver witness confirms unrelated draft publications do not rewrite the unchanged Refresh live region. Existing suites continue to cover conflict retention, exact request recovery, focus and gesture lifecycle.

## Browser acceptance

The coordinating agent ran the final built widget through the actual local SPA/generated-widget shell with synthetic API responses. All final browser checks passed: 10 geometry scenarios, four pull scenarios and 12 behavior flows across four widths. Geometry covers labelled navigation, absent footer, bounded independent scrolling, long names and IME resize. Behavior covers Undo across refresh and dismissal, failed Undo retaining its target, unknown Action edit Check/navigation/refresh/exact retry, and wide unknown recovery moving to List when a different inspector is selected. The final 390 px dark and 2048 px wide screenshots were visually reviewed.

Session evidence: `/tmp/weave-feedback-geometry-browser.json`, `/tmp/weave-feedback-pull-browser.json`, `/tmp/weave-feedback-behavior.json` and their corresponding geometry/pull/behavior logs. The scripts `/tmp/weave-feedback-{geometry,pull,behavior}.mjs` consume `/tmp/weave-feedback-candidate.html`, copied from the final build. These are local evidence files, not committed generated artifacts. The candidate submission includes these evidence references.

The browser fixture initially lacked a preview responder; that harness defect was corrected before final behavior acceptance. Earlier browser runs were superseded by the final artifact run after target-placement, live-announcement, compact-notice and displayed-Undo-identity corrections.

## Limitations

`docs lint --conformance` encountered a pre-existing tool/schema mismatch: repository design `boundaries.forbidden` items are strings, but the installed CLI calls `.get("target")` on them. Ordinary schema/reference lint passes. This change does not alter that unrelated document schema or CLI. The change package remains active pending actual-host/hardware acceptance; delivery/review results are recorded separately.

Local PostgreSQL, generated-resource DOM and Chromium checks do not establish hosted Neon, trusted production authentication, actual ChatGPT resource caching, native iOS compositor or physical-device behavior. No deployment or actual-host acceptance was performed by this implementation agent.
