---
change: change-20261031-search-default-active
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

## Checks

- Pure outline tests distinguish Search defaults from opt-in status/Defer intersections and retain draft-aware matching.
- Interaction and controller tests cover fresh-open defaults, query and close behavior, shared visible rows, retained proposals and no API calls.
- DOM tests cover Display options, zero read/write effects, inspector and draft retention, and menu Escape priority.
- `pnpm check` and `pnpm build` are required before browser acceptance. Browser acceptance is owned by the root agent.

## Results

- `pnpm check`: passed lint and typecheck; all 758 tests passed with no failures, skips or TODO passes.
- `pnpm build`: passed for the Node service, static SPA, standalone local MCP and noninstallable plugin template.
- Browser acceptance on the built artifact at 390 px: defaults showed two matches; enabling completed, deferred and dropped produced counts of 3, 4 and 5. Display menu Escape retained Search and its query; clear retained filters; close/reopen reset Search to two defaults. Search/filter gestures produced zero API calls. An invalid raw empty Title remained present with `aria-invalid=true`; no horizontal overflow was observed.

Two earlier UI verification attempts failed during implementation: one ran against stale generated widget output, and another used fixture expectations that did not account for the draft-composed Search results. The widget was regenerated and the fixture assertions were corrected before the passing final check.

The browser acceptance was performed by the root agent; deployed host acceptance was not part of this change.

Independent review approved the implementation without actionable findings. The implementation Profile completed with `SUCCEEDED` and ledger `39f73e9807214241f72029115d8d61e4294fff2b6da597af30de3c803d4753b7`. No commit, push or deployment was performed for this correction.
