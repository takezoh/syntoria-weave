---
change: change-20261031-detail-header-regression
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

## Content

The focused DOM coverage checks mobile Action, Project and Tag screen ownership, generated CSS ownership, Back focus/scroll recovery, narrow Search navigation, and wide Search filtering with retained drafts and no persistence effects. These DOM assertions do not establish media-query geometry.

`pnpm check` passed lint, typecheck and all 759 tests with no failures, skips or TODO tests. `pnpm build` passed and verified the 13-file noninstallable template against the current source.

Chromium browser acceptance passed against the built widget served by the temporary local PostgreSQL preview on port 5200, which was stopped afterward. At 390 × 844, the List header was visible; Action, Project and Tag Detail each hid the global header, showed the Detail toolbar and hid the List; Back restored the List header for each. Mobile Search for `needle` showed the two default results, opening one hid the global header, and Back retained `needle` and restored the header. Computed geometry showed the mobile header as `display: none`, toolbar top at 0, content top at 57 px, and client/scroll widths both 390 px. At 1280 × 900, the Action Detail retained the global header and List alongside the toolbar.

These checks establish local Chromium behavior only. They do not claim deployed-host, actual MCP host, native iOS compositor or physical-device acceptance.
