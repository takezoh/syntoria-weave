---
id: design-ui-visual-policy
kind: design
title: Shared UI Visual and Interaction Policy
status: active
created: '2026-10-30'
summary: The shared UI is icon-first, text-minimal and dense; mobile uses separate
  List and Detail pages; human-facing text renders as Markdown while caller metadata
  stays hidden.
scope_type: policy
responsibilities:
- id: RESP-001
  statement: Decide how shared UI surfaces present controls, text and layout so the
    limited panel area serves the person's state and decisions.
- id: RESP-002
  statement: Decide which saved text the shared UI renders for people and which caller-managed
    data it never displays.
invariants:
- id: INV-001
  statement: A control whose meaning an established icon conveys is icon-only, with
    its name in aria-label and title, never in visible text.
  enforcement: review
- id: INV-002
  statement: Surfaces add no explanatory copy, syntax hints, helper sentences or derived
    meta text that the person does not need to decide or act.
  enforcement: review
- id: INV-003
  statement: Layout uses compact single-row toolbars and wrapping property chips instead
    of stacked labelled sections; text length never breaks a toolbar or row.
  enforcement: review
- id: INV-004
  statement: On narrow widths Action List and Action Detail are separate pages; Detail
    never opens inside or above the list.
  enforcement: review
- id: INV-005
  statement: Human-facing text renders through the shared Markdown subset; caller-managed
    metadata is never rendered, copied into visible UI or logged.
  enforcement: review
boundaries:
  provides:
  - Visual and interaction rules for every shared UI surface
  consumes:
  - UI architecture principles
  - readonly model projections
  - the generated icon vocabulary
  forbidden:
  - Visible labels on icon-sufficient controls
  - Explanatory or instructional copy inside product surfaces
  - Displaying Action or collaboration metadata
variability:
  fixed:
  - Icon-only controls with accessible names
  - Markdown subset rendering through typed DOM nodes
  - Mobile List and Detail as separate pages
  free:
  - Exact sizes, spacing and colors within the existing token set
  - Icon artwork within the generated 24px line vocabulary
capabilities: []
failure_responsibilities:
- A reviewer rejects UI changes that add visible text to icon-sufficient controls
  or add explanatory copy.
trust_boundaries:
- Rendered Markdown comes from user and caller text and is data; it never renders
  raw HTML or executes content.
compatibility_policies:
- Collaboration records carry one caller-managed `metadata` text, as Actions do; it
  is returned by API/MCP and never rendered.
tags:
- ui
- design
owners: []
relations:
- {type: partOf, target: design-product}
source_paths:
- lib/widget.ts
---

## Purpose

The shared UI exists so a person can see and correct shared state quickly in a conversation side panel or full window. Every pixel either shows state or offers a decision. Simple, modern and dense is the standard; explanation belongs in documentation, not in the product.

## Responsibilities

- **Controls.** Status choices (Open, Waiting, Done, Dropped), Flag, Edit/Done editing, Close, Back, Refresh, Add, Display options, Copy request for AI, History, Undo, Send and Stop are icon-only buttons. Their names live in `aria-label` and `title`. Pressed or current state is shown by fill, background or color, not by added words.
- **Text.** Visible text is limited to user and caller content (titles, notes, proposals, reports, names, dates) and the few words a decision cannot do without, such as a primary action label like Approve or a short status pill. Do not add helper sentences, Markdown syntax hints, relative-date suffixes, version lines or "why this is disabled" explanations.
- **Density.** Toolbars are one row. Action properties (Project, Deadline, Hide until, Tags) are wrapping chips under the title; an unset property is an icon-only chip. An editor opens inline only for the chip being edited. Form inputs carry accessible names instead of visible labels when their content is self-evident. Labels that must stay visible are short enough never to wrap a toolbar or row.
- **Navigation.** Desktop uses a compact icon rail, the list and a Detail pane. Narrow widths push from Action List to a full-page Action Detail with Back; returning restores the list scroll position and selected row. Unsaved drafts and unknown outcomes are retained across the transition by the controller, as for any other navigation.

## Boundaries

This policy governs presentation only. Transitions, validation, drafts and recovery stay in the model and controller described in [UI architecture](../technical/ui-architecture.md#development-principles); components keep consuming readonly projections and callbacks.

## Invariants

- Action notes, collaboration instructions, scope, outcome, exclusions, source, report summary, remaining work and user feedback render through the same Markdown subset as Notes ([`rich-text.ts`](../../lib/ui/model/rich-text.ts)): paragraphs, headings, lists, quotes, code, rules, links and emphasis. Titles render inline. Raw HTML is never rendered.
- Caller-managed metadata (Action and collaboration `metadata`) is returned by API/MCP but never shown in the UI.
- Accessibility is not traded for density: real `button`, `a` and `input` elements, accessible names on icon-only controls, 4.5:1 text contrast and adequate touch targets on touch devices.

## Collaboration

The Work with AI card shows a status pill, the proposal title, the Markdown body and its labelled fields, one primary decision beside the delegation selector, a one-line reply composer with a send icon, and icon actions for edit, copy, history and stopping approved work. The same card appears in Action Detail and, without a nested frame, in Now's Waiting on you list.

## Failure Responsibility

Review owns enforcement. A change that adds visible text to an icon-sufficient control, adds explanatory copy, or shows metadata does not conform and is corrected rather than accepted as precedent.

## Variability

Sizes, spacing and colors may change within the existing light/dark token set in [`widget.ts`](../../lib/widget.ts). The icon vocabulary in [`icons.ts`](../../lib/ui/model/icons.ts) may grow when a control needs a new icon.

## Conformance

Check UI changes against INV-001 to INV-005. The narrow-width view rail panel keeps visible names because it is a menu of destinations, not a toolbar.

## Related Decisions

- [Product design](product.md)
- [Action state and perspectives](design-action-state-and-perspectives.md)
