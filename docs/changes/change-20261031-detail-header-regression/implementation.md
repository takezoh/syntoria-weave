---
change: change-20261031-detail-header-regression
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

## Content

`lib/ui/components/layout-styles.ts` owns viewport, chrome and screen visibility across breakpoints. Restore the narrow screen-state selector there so both Action and Catalog Detail hide `main > header`; keep the wide layout unchanged. Do not add Search to either Detail toolbar.

Update the DOM coverage to require the generated widget CSS rule instead of asserting that no mobile header rule exists. Keep mobile Search interactions on the List, including Back from a selected result, and exercise inspector retention, Display filters, draft preservation and no-effect behavior in a wide layout where the header remains present. Preserve the preceding Search-defaults changes and their contracts.
