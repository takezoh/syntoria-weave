---
change: change-20261030-collaboration-view
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

On 2026-10-30 the owner decided to remove Now: Add already sits in the header, a fixed seven-day deadline panel is better served by a perspective, and every view should be an Action list. Collaboration replaces Now and every row with collaboration data shows its status as an icon. The owner also asked for a favicon and a considered window title.

- FR-001: The view rail shall list Collaboration, Inbox, Flagged, Projects, Tags, Changes and Done & dropped; the widget shall land on Inbox.
- FR-002: Collaboration shall be an Action list of the Actions that hold at least one collaboration record, applying the usual display choices (unfinished and nondeferred by default) and list order.
- FR-003: Open suggestions of new work that no Action holds (not rejected or withdrawn) shall render above the Collaboration list with their adoption choices, and nowhere else; the section shall be hidden when there are none.
- FR-004: Every Action row with collaboration records shall show one icon for the most urgent record, in the order alert (stop requested or outcome unknown), reply, result, proposal, running, requested, external wait, revising, deferred, stopped, declined; its accessible name and tooltip shall be the record's label, with the count for several proposals. Waiting on the person shall use the attention tone, proposals and AI work the accent tone, the rest muted, and a completed or dropped Action shall be muted.
- FR-005: The Collaboration rail badge shall count the records waiting on the person; the Changes badge shall count new connection changes in every view.
- FR-006: The document title shall be the current view name preceded by the waiting count, never Action text. A host advertising `hostCapabilities.experimental.title` shall receive it through `web/title`; the web shell shall append the optional configured `appName` and reject empty, overlong or control-character titles.
- FR-007: `appName` shall be optional runtime input of 1–60 plain characters, rendered into `/runtime-config.json`; the product name stays out of source.
- FR-008: The SPA shell pages shall link an SVG favicon, a 32 px PNG and a 180 px Apple touch icon.
- FR-INV-001: Collaboration writes, recovery, unknown outcomes and Undo shall behave as before.

Counterexamples: Now still reachable; a deferred Action listed in Collaboration by default; a suggestion card in Inbox; two identical bulb icons for a proposal and running work; an orange icon on a completed Action; the Changes badge empty until Changes is opened; an Action title in the tab; a product name in tracked source.
