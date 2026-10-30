---
change: change-20261030-mobile-interaction-ownership
role: implementation
---

# Responsibility and implementation

## Screen contract

`model/screen.ts` owns the readonly screen projection. `effects/screen.ts` applies screen changes and retains the List position and occurrence focus. The widget supplies a stationary List header, Action and Catalog toolbars, independent detail content containers, and a shared recovery footer. Inspector components render only their injected readonly projections. Mobile Detail replaces List chrome; wide inspection preserves the visible List.

The SPA shell owns browser viewport and browser safe-area padding. The widget applies only supplied host insets. No estimated status-bar height or covering element is introduced.

## Gesture contract

`model/list-gesture.ts` is the only intent arbiter for native scrolling, pull, swipe and held movement. `effects/list-gesture.ts` owns event normalization, timers, cancellation, capture and visual effects. Touch Events are the authoritative touch stream; touch-origin Pointer Events do not compete. Pen uses the same arbiter, with active-contact termination observed beyond the starting surface. Mouse/native dragging remains an explicit separate source.

Touch listeners are installed before a contact and scoped to the List. Pending touches do not prevent default. A claimed motion must cancel its live event; native scrolling never transitions back into an application gesture. Primary row buttons and their children are eligible, while auxiliary controls and editable inputs retain normal behavior. A stationary hold does not try to cancel an expired event. It ends its movement context before opening the chooser. Only pull eligibility is mobile-specific; row gestures remain available on a visible wide List.

The old separate pull and row-press reducers are removed. Ordinary scrolling performs no row layout measurement or application transform updates. Feedback is an overlay transform, not a change to List height.

## Read contract

`application/refresh.ts` owns one coalesced read lane and deferred intent. Controller idle notifications resume reads after writes and IME composition; the final composition value is retained before releasing the gate. `effects/refresh.ts` emits requests from the button and foreground lifecycle. Gesture completion is another request source. The existing controller owns snapshot acceptance, revisions, drafts and exact unknown-request recovery.

## Rejected alternatives

- A header-only CSS rule leaves screen, focus and scroll ownership unspecified.
- Dynamic touch cancellation listeners leave first-contact behavior dependent on browser event timing.
- Independent pull and row handlers allow two owners to react to one contact.
- Reloading the document discards the retained proposal and recovery context.
- Early mouse capture retargets ordinary catalog button clicks; capture belongs to the claimed drag.

## Review corrections

Browser and independent review found and corrected the catalog click/capture path, catalog focus-key restoration, movement context cleanup after held release, viewport eligibility separation, and pen termination outside the List. Native iOS acceptance remains a separate, open verification boundary.
