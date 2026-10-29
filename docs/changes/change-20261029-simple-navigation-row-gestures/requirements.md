---
change: change-20261029-simple-navigation-row-gestures
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

## Navigation

- FR-001: The widget shall have exactly one navigation, the view rail, listing every view and saved perspective once. On wide layouts it shall be a sticky column beside the list; on narrow layouts it shall be hidden until the person taps the current view's title, then shown below the header.
- FR-002: The title toggle shall expose `aria-expanded` and `aria-controls="viewRail"`. Choosing a view, pressing Escape or pointing outside the rail shall close it; choosing a view or Escape shall return focus to the toggle. Opening shall focus the current view, or the first view when the current item is unavailable.
- FR-003: The current view and perspective shall be marked with `aria-current="page"`. An unavailable perspective shall stay listed, disabled and current.
- FR-004: When the host advertises `hostCapabilities.experimental.signOut`, the rail shall end with Sign out, which sends one `web/sign-out` request. Hosts without it shall show no Sign out.

## Content

- FR-005: The list panel shall not show a collaboration overview or a perspective conditions summary. Proposals and reports that need the person stay on Now; others stay in their Action's details.
- FR-006: Now's capture shall be a text field with a Save button and no hint text. Empty states shall state the state only.
- FR-007: The details shall show no status explanation, no date help text and no Notes label; Changes shall have no introduction or footnote.

## Rows

- FR-008: An Action row with proposals still awaiting the person (pending, deferred or in revision, not started) shall show a Proposal badge, or "N proposals", before its other badges. Approved, running or closed records shall not count.
- FR-009: Action rows shall have no separate move handle.
- FR-010: For a touch or pen press on an Action row or a Now row, a move within 10 px shall leave the press pending; a larger move that is more than 1.5 times as horizontal as vertical shall become a swipe; any other move shall be left to scrolling.
- FR-011: While swiping right on an unfinished Action that can be written, the row shall show Done from max(64 px, 25 % of the row width) and Dropped from max(Done + 72 px, 55 % of the width); releasing shall send one ordinary complete or `dropped` status write. Swiping left shall show Ask AI from the same Done distance when collaboration is available, and releasing shall open the Action with the AI request field focused. A direction that is not available shall only resist by at most 16 px and choose nothing.
- FR-012: A pending touch or pen press on an Action, Project or Tag row held for 500 ms shall lift the row. Moving it shall start the ordinary drag; releasing it in place shall open the Move chooser for that row.
- FR-013: With a mouse, rows shall keep native and pointer dragging; right-click or the keyboard context-menu key on an Action row shall open the Move chooser, which returns focus to the Action when closed.
- FR-014: The tap a browser sends after a swipe or a hold shall not open the Action. A plain tap shall still open it.
- FR-015: On coarse pointers the row complete control shall be visually hidden but remain available to assistive technology.

## Web shell

- FR-016: The web shell shall show its access bar only while sign-in, retry or account recovery needs the person. It shall answer `web/sign-out` from its workspace frame by running its existing logout and showing the bar again, keeping the frame mounted.

## Invariants

- FR-INV-001: Swipe and long-press writes shall use the existing controller lane with the ordinary operation ID, revision, receipt, unknown-outcome recovery and Undo; no new write path is added.
- FR-INV-002: Mouse movement, keyboard selection and existing drag behavior shall not change.
- FR-INV-003: No server, data or MCP contract shall change.
