---
change: change-20261031-responsive-scroll-ownership
role: verification
---

# Verification

- The prior deployed artifact failed the 1024px assertion that the footer is in the viewport. A long selected perspective also expanded the narrow header.
- Final pnpm check: 742 passed; zero failed, cancelled, skipped or TODO. Lint and typecheck passed. Build passed.
- Chromium geometry/interaction acceptance passed ten viewport cases: 390x844, 768x1024, 820x1180, 850x700, 851x700, 1024x768, 1180x820, 1366x768, 2048x1100 and 1024x420.
- Twenty-five saved perspectives include a long Japanese name and an unbroken English name. Text rectangles fit their buttons; selection and navigation scrolling work. Header/footer remain stationary, list/detail scroll independently, and the outer document has no horizontal or content-height overflow.
- Mouse edge drag scrolls the list and an outside release cancels it. Editing afterward and resizing between 820px and 1024px preserves the same input node and IME value. DOM tests cover application edge scrolling and termination for native and pointer paths.
- Four deferred-read pull feedback cases passed after the final layout change, including reduced motion, loading status, success/error restoration and ordinary native scrolling.
- Independent review accepted the final candidate.

## Limits and diagnostic observations

The initial detail layout exposed absolute accessibility labels outside its containing block; the final detail scroller owns their positioning as well as clipping. The final browser assertions guard document overflow.

In the headless Chromium diagnostic, synthetic Escape ended native drag events but UA autoscrolling continued with zero application scrollBy calls. Outside release terminated normally. This diagnostic is not a passing Escape acceptance test, and no speculative product compensation was added. Actual tablet hardware, native iOS compositing and physical input behavior remain unverified. Ordinary documentation lint passes; existing repository-wide conformance tooling cannot process historical forbidden-string design entries.
