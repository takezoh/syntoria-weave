---
change: change-20261030-dense-icon-first-ui
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

The owner reviewed the Action Detail and app redesign canvas on 2026-10-30 and asked for it to be implemented. Behaviour follows the [visual policy](../../design/design-ui-visual-policy.md).

## Action Detail

- FR-001: When an Action is selected, Action Detail shall show one toolbar row with the lifecycle choices Open, Waiting, Done and Dropped, Flag, the Edit/Done toggle and Close as icon-only buttons whose names are their accessible names and tooltips. On narrow layouts Back shall replace Close.
- FR-002: Under the title, Action Detail shall show property chips for Project, Deadline, Hide until and each linked Tag, plus an icon-only chip to link Tags. A chip shows the current draft value; an unset Deadline or Hide until chip is icon-only, an invalid one shows the raw input with a warning, and an empty own Hide until under a deferred parent marks that a parent hides the Action.
- FR-003: Pressing the Deadline or Hide until chip shall open its editor inline with quick dates, date and time inputs and the existing errors and release controls, and focus its date input. Pressing the chip again, Escape or a press outside the chip and editor shall close it; at most one editor or picker is open.
- FR-004: Notes shall render as a document below the chips, and one line shall show who added and last changed the Action with an icon-only link to recent changes.
- FR-005: Action Detail shall not show explanatory text, Markdown syntax hints or visible labels for self-evident inputs.

## Work with AI

- FR-101: Collaboration cards shall render the proposal title inline and the instructions, scope, expected outcome, exclusions, source, report summary, remaining work and the person's latest instruction as the shared Markdown subset, without raw HTML. A field with no text shall have no row.
- FR-102: Approve, Create action, Create and delegate and Link to selected action shall be labelled primary buttons beside the delegation selector; Ask AI to revise and Send response shall be the send icon of the reply composer; Cancel approval shall be a stop icon in the card header; Record outcome shall sit beside the outcome selector. Edit proposal, Copy request for AI and History shall be icon-only header controls.
- FR-103: The request composer shall be one line with a send icon and shall be hidden when no new request is possible for the selected Action.
- FR-104: Re-rendering unchanged collaboration text shall keep its rendered nodes.

## Lists, rail and Now

- FR-201: On wide layouts the view rail shall be a column of icon-only buttons with tooltips; Now shall show the number of collaboration records waiting on the person and Changes the number of new connection changes as badges, each spoken with its meaning.
- FR-202: Action row badges shall show Proposal, collaboration status, Waiting, Later, Done and Dropped as icons named by their text, the deadline as its date with a spoken "Deadline" prefix, and parent, Project and Tags as muted text; wide rows keep title and badges on one line.
- FR-203: Now section headings shall be short (Waiting on you, Changes, Flagged, Next 7 days), and Review all changes, Mark as reviewed, Try again and See all flagged shall be icon-only header controls; capture shall be one line with a send icon.

## Narrow layouts

- FR-301: When Action or catalog details open on a narrow layout, the list content and list header shall be hidden while save feedback, retained proposals and unknown-outcome recovery remain visible; the page shall start at the top of the details.
- FR-302: Back shall return to the list at the scroll position it had when details opened and return focus to the row. Wide layouts shall not move the page.

## Invariants

- FR-INV-001: Drafts, autosave, conflicts, unknown-outcome recovery, exact replay and Undo shall behave as before; this change alters presentation and picker view state only.
- FR-INV-002: Caller-managed Action metadata shall remain absent from every rendered surface.

Counterexamples: a status button whose visible text reappears; a closed date editor hiding partial raw input instead of showing it on the chip; a press inside the date editor closing it; Markdown markers such as `**` or `###` shown in a card; an empty Excluded row; the Approve button inside the composer; the list or its header remaining under the narrow Detail page; the unknown-outcome recovery disappearing on that page; Back landing at the top of the list.
