---
change: change-20261030-mobile-interaction-ownership
role: requirements
---

# Mobile interaction ownership

## Scope and authority

The confirmed mobile contract is a stationary List header and recovery footer with a single scrolling content region, pull-to-refresh at the List top, refresh on foreground return, and the retained Refresh button. Action and Catalog Detail replace List chrome with their own stationary toolbar. Back restores the List position and occurrence focus. Desktop split inspection remains available.

## Requirements

- R1: While narrow, exactly one page header and one content scroller are active. Action, Project and Tag details use the same screen ownership contract.
- R2: A contact sequence has one owner: native scroll, pull, swipe or held movement. Once native scrolling starts, the sequence cannot later become a pull or long press.
- R3: Primary row activation surfaces and whitespace permit pull. Auxiliary controls and editable fields preserve their ordinary interaction. A stationary hold may open the chooser; moving a held row first requires cancellation of its live move event.
- R4: Refresh button, threshold pull release and foreground return share one application read lane. Writes and IME defer pending reads. Draft values, compatible nodes, caret and exact unknown request identity survive refresh and screen changes.
- R5: Cancellation, multitouch, screen/lifecycle changes and disposal release all sequence effects and cannot cause delayed commits.
- R6: The shell owns browser viewport and browser safe-area padding; the shared widget owns its internal screen and supplied host insets. Do not infer status-bar dimensions or add covering bands.

## Acceptance boundaries

Pure tests establish decisions; DOM tests establish event orchestration and retained state; browser tests establish geometry and browser-dispatched touch behavior. Native iOS Home Screen compositing and physical scrolling acceptance require actual-device evidence. Passing Chromium or listener-count checks cannot establish them.

## Counterexamples

A Detail screen with the List header still visible violates R1 even if its Back button works. A passing synthetic pointer-only touch test does not establish pull cancellation in a browser. Excluding every button violates row-origin gestures because primary row surfaces are buttons. Calling preventDefault on an old event from a hold timer does not cancel a new native pan. Losing an unknown operation ID on refresh violates R4 even if the list looks current.
