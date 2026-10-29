---
change: change-20261029-simple-navigation-row-gestures
role: verification
---

<!-- lifecycle is owned by change.md -->

# Verification

Local working tree on 2026-10-29, before commit.

## Pure models

- `tests/ui/row-press.test.mjs`: a press stays pending inside 10 px, becomes a swipe only when more than 1.5 times as horizontal as vertical and only for swipeable rows, and otherwise is released; only a pending press on a movable row becomes a hold; Done and Dropped thresholds at the exact boundaries on wide and narrow rows, Ask AI on the left, travel clamped to the row, and a disallowed direction resisting by at most 16 px without a choice.
- `tests/ui/collaboration.test.mjs`: `actionProposalCount` counts pending, deferred and in-revision not-started records for that Action only, ignoring approved, rejected, withdrawn and running ones, without mutating input; the row projection puts "Proposal" or "N proposals" first with the proposal tone and changes its signature.

## Generated widget (JSDOM)

- One navigation: a single `nav` with each view once and no menu-radio items; the title toggle opens the rail with `aria-expanded`, focuses the current view, closes on choosing a view, Escape or pointing outside (not inside) and returns focus; `aria-current` follows views and perspectives; an unavailable perspective stays disabled and current, and opening then focuses the first view. Perspectives open by escaped name without a conditions summary.
- Sign out appears last in the rail only when `ui/initialize` advertises `hostCapabilities.experimental.signOut` and sends one `web/sign-out`.
- A pending proposal shows the Proposal badge in Inbox, is approved from Now's waiting-on-you list with one exact-revision write, and the row then shows the approved state without the badge; no collaboration overview exists.
- Touch swipes: 100 px on a 300 px row sends one `complete`, 200 px one `status` `dropped`, −100 px opens the Action with the AI request field focused and writes nothing, 30 px writes nothing; each swipe prevents scrolling, resets the row and swallows the trailing tap. A completed Action without collaboration support only resists in both directions and writes nothing. Now rows complete the same way.
- Long press: a pending press lets the list scroll; after 500 ms the row is lifted, owns the pointer and blocks scrolling; releasing in place opens the Move chooser and Cancel returns focus to the Action; holding and moving starts the ordinary drag, and cancelling it writes nothing. A touch that scrolls first never swipes or holds, and a plain tap still opens the Action. A Tag row does not swipe, and a long press opens its chooser at Into.
- The context menu event on an Action opens the Move chooser and is prevented; Escape and Cancel return focus to the Action. Existing focus-retention, reorder and drag tests now use the Action and Flag controls instead of the removed handle. The inspector, Now and Changes have no status hint, date help, Notes label, capture hint row or footnotes.
- `tests/ui/web-session-relay.test.mjs`: the SPA hides its access bar while signed in, advertises the sign-out capability, answers `web/sign-out` with its logout, shows the bar again and keeps the frame mounted.

## Screens

Headless Chrome screenshots of the generated widget with a synthetic in-page host at 1280 × 900 and at 390 × 844 with coarse-pointer emulation showed the sidebar without a header dropdown, the Proposal badge, Sign out at the bottom of the rail, the disclosed rail on the phone, hidden completion circles, and the Done, Dropped and Ask AI swipe states. They revealed and led to fixing swipe colors that lost to a more specific base rule.

## Repository gates

- `pnpm check`: lint, typecheck and 667 tests passed, with no failures, cancellations, skips or TODOs.
- `pnpm build` passed, including the plugin artifact verification, and `pnpm test:node:built` passed against the built server and real PostgreSQL.

## Limitations

Synthetic pointer events in JSDOM and headless Chrome do not prove real touch behavior: browser scrolling, `touch-action`, implicit pointer capture hand-over, click synthesis after a swipe, haptics and the iOS callout need a real device. ChatGPT host rendering is unverified.
