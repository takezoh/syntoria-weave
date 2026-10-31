---
change: change-20261031-detail-header-regression
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

## Content

The mobile screen ownership contract for Action, Project and Tag Detail was already defined by [mobile interaction ownership](../change-20261030-mobile-interaction-ownership/requirements.md): a narrow Detail page replaces the List page chrome, and Back restores the List position and focus. Merge `945a93e` removed the shared mobile CSS rule that hid the global header for Action and Catalog Detail while making Search reachable. That left the header visible on Detail and violated R1.

- R1: At widths up to 850 CSS px, Action and Catalog Detail hide the global List header and show their own stationary toolbar. The same Catalog Detail behavior applies to Projects and Tags.
- R2: On wide layouts, the global header and visible List remain alongside the inspector.
- R3: Mobile Search remains a List-header control. A person returns to the List before opening or filtering Search; Detail gains no Search control.
- R4: Back from Action, Project or Tag Detail restores the List scroll position and occurrence focus.

## Counterexamples

- A global List header remains visible above a narrow Action or Catalog Detail toolbar.
- CSS hides the global header on a wide split layout.
- A narrow DOM test clicks a header Search control while the app is in Detail.
