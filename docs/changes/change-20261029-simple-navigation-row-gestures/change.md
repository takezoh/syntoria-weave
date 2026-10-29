---
id: change-20261029-simple-navigation-row-gestures
kind: change
title: One navigation, no explanatory text, proposal badges and touch row gestures
status: draft
created: '2026-10-29'
profile: sdd@1
intent: After the UX-first release the owner asked for a simpler UI. The header menu
  and the view rail duplicated each other, several controls carried explanations of
  what they plainly do, proposals were invisible in lists, and the row handle and
  completion circle made touch use awkward. The owner asked to deploy once done.
outcomes:
- One view rail is the only navigation, a sidebar on wide layouts and a panel disclosed
  from the title on narrow ones.
- The list-wide collaboration overview, the perspective conditions summary, the capture
  hint row and explanatory hints are gone.
- Action rows mark proposals awaiting the person.
- On touch, swiping right finishes an Action (Done, then Dropped further along) and
  swiping left asks AI; a long press lifts a row to move it. The move handle is gone.
- The web shell's sign-out-only bar is gone while signed in; Sign out ends the rail.
scope:
- lib/ui/**
- lib/widget.ts
- web/client.ts
- web/index.html
- tests/ui/**
- ARCHITECTURE.md
- docs/technical/ui-architecture.md
- docs/technical/infrastructure.md
non_goals:
- New data, write tools, migrations or Gate changes.
- Swipe gestures for Project and Tag rows.
- A defer or snooze swipe.
change_classes: []
governance:
  gate: auto
  reasons: []
members:
- role: requirements
  path: changes/change-20261029-simple-navigation-row-gestures/requirements.md
  required: true
- role: implementation
  path: changes/change-20261029-simple-navigation-row-gestures/implementation.md
  required: true
- role: verification
  path: changes/change-20261029-simple-navigation-row-gestures/verification.md
  required: true
promotion: []
unresolved_decisions: []
tags: []
owners: []
relations:
- type: references
  target: change-20261029-ux-first-redesign
source_paths: []
summary: Single view rail, removed explanations and overview, proposal badges, touch
  swipe and long-press row gestures, and Sign out moved into the workspace.
---

## Summary

On 2026-10-29 the owner reviewed the released UX-first UI and asked for a simpler one: the header dropdown and the sidebar were the same and should be optimized per layout, the collaboration overview, the perspective summary and the capture hint row had no clear purpose, intuitive controls should not be explained, Actions with proposals should be visible in lists, mobile Done should be a swipe with Done and Drop chosen by distance in one direction and AI requests in the other, and the left-edge handle should be replaced by a long press on the card. They then asked to remove the web shell's undesigned sign-out-only header and to deploy when done.

Answers given for the questioned elements: the collaboration overview listed every proposal and report below the list, duplicating Now's waiting-on-you list; the scope summary spelled out a perspective's filter conditions; the capture row only held the hint text beside the Save button. All three are removed.

Sign out is kept, because removing the bar alone would leave a signed-in person no way to sign out; it moves into the workspace rail and is shown only when the host advertises it.

## Closure Notes
