---
change: change-20261031-pull-refresh-feedback
role: verification
---

# Verification

## Candidate evidence

- pnpm check passed: 742 tests, zero failed/cancelled/skipped/TODO; lint and typecheck passed.
- pnpm build passed.
- The pre-change deployed widget failed the new Chromium assertion that a subthreshold pull moves List content.
- Four deferred-response browser cases passed: 390x844, 459x938, 844x390 and 390x844 with reduced motion. A 160px contact movement displaced content by 80px; threshold release settled at 48px until the read completed. The indicator remained above the first row.
- Pending reads replace the previous success status with Refreshing; success is published only on settlement. The review finding about stale Up to date text was corrected in the application coordinator and checked with a held response.
- Short release and cancellation performed no read. Success and failure restored content. Button refresh did not displace content. Ordinary native scrolling remained available.
- Synthetic HTTP 503 triggers the existing shell recovery notice, reducing iframe height; the error check confirms content restoration, no extra document height and the footer at the resulting iframe bottom. It does not require the old iframe dimensions.
- The previous five-viewport browser regression suite passed, including separate Detail chrome, Back focus/scroll, touch gestures, foreground refresh and desktop split inspection.
- Independent implementation review accepted the candidate.

## Limits

Chromium dispatch and synthetic HTTP do not establish native iOS Home Screen composition, physical touch latency or authenticated deployed UI acceptance. This package remains active for actual-device acceptance. Ordinary documentation lint passes; repository-wide conformance cannot complete because the existing tool assumes objects for historical forbidden-string design entries. No unrelated design data is rewritten.
