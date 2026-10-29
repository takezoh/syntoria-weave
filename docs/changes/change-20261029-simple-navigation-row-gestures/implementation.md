---
change: change-20261029-simple-navigation-row-gestures
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

## Navigation

The header menu markup, its menu-radio roving focus and the `data-rail-view` duplicates are removed. Rail buttons carry `data-view`; `renderNavigation` marks the current view and perspective with `aria-current` and rebuilds perspective buttons only when the perspective list or the unavailable state changes. The header heading is static; `#navigationToggle` is shown only at 850 px and below, stretched over the title, and reuses the existing header-menu state (`headerMenu: 'navigation'`) to set `data-open` on the rail. Legacy `nav` sidebar rules that leaked into the rail are removed.

`createDisplayBridge` records `hostCapabilities.experimental.signOut` from `ui/initialize` in `DisplayState.signOut`, and `renderDisplay` shows `#signOut`. The SPA advertises the capability, handles `web/sign-out` with `performLogout` and hides `#access` while authenticated.

## Content

`#collaborationOverview`, the second collaboration panel instance, `#scopeSummary`, `#statusHint`, `statusHint` and its `hasChildren` input, the date help, the Notes label, the Now capture hint row and deadline note, and the Changes introduction and footnote are removed. The perspective model still computes its summary, which also detects unavailable definitions. The clipboard fallback field now appears after the card's Copy button, which the panel passes as the origin.

## Rows

`actionProposalCount` in `model/collaboration.ts` counts not-started records whose decision is pending, deferred or changes requested; `projectActionRow` puts a `proposal`-toned badge first and includes the count in the row signature. `ActionRow` drops the grip and gains `oncontextmenu`, which `patchNode` carries.

`model/row-press.ts` holds the pure policy: `pressMove`, `pressTimeout` and `swipeChoice`. The DOM adapter keeps one `press` per pointer: `beginPress` for touch and pen from Action, Project, Tag and Now rows; `movePress` captures the pointer when a swipe starts and applies `--swipe-offset`, `data-swipe-side` and `data-swipe`; `endPress` sends `controller.direct('complete' | 'status')` or opens the Action and focuses the request field through the panel's `focusRequest`. A hold calls the existing `beginPointer` on the row so drag, geometry, destination and commit stay as they were; a hold released before the drag activates opens the chooser through `openRowMove`, shared with the context menu. The outline stays stable during a swipe. A non-passive `touchmove` listener prevents scrolling only during a swipe or hold. A capture listener swallows the next click for 400 ms or until the next pointer down. Capture loss reported by an element inside the captured row is the hand-over from implicit touch capture and no longer cancels the drag.

CSS adds `touch-action: pan-y`, no callout and no text selection on coarse pointers, the swipe backgrounds as row pseudo-elements clipped by the list, the lifted state and the visually hidden complete control.
