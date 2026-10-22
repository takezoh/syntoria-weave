---
change: change-20261022-action-text-view-mode
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

- FR-001: When an Action is selected, Action details shall show Title and Notes in view mode, rendering the current draft text (including unsaved proposals) without changing saved values.
- FR-002: View mode shall render paragraphs with preserved single line breaks, headings, bullet/ordered/task lists, quotes, fenced code, rules, code spans, emphasis, strikethrough and links. Raw HTML shall remain literal text.
- FR-003: Only http, https and mailto destinations shall become links; other or relative destinations remain literal source text. Activating a link shall request `ui/open-link` from the host and shall not navigate the widget.
- FR-004: Raw Title and Notes inputs shall be available only after an explicit Edit action. Done shall flush the proposal, return to view mode and keep focus on the toggle.
- FR-005: A new local Action shall start in edit mode with focus in Title and remain in edit mode when its identity is confirmed.
- FR-006: Edit mode shall belong to the selected Action only and end on selection change or close, except that an invalid Title or Notes proposal stays (or reopens) in edit mode until corrected.
- FR-007: Done during IME composition shall be deferred until the final text is captured.
- FR-INV-001: Existing autosave, proposal retention on refresh/host notifications, conflict and unknown-outcome recovery behavior shall be unchanged.

Counterexamples: `[x](javascript:...)`, `<img onerror>` and `<script>` must not produce elements or links; text selection in view mode must not be lost by unrelated renders; pathological delimiter input must not cause superlinear parsing.
