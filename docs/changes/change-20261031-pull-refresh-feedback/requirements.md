---
change: change-20261031-pull-refresh-feedback
role: requirements
---

# Pull feedback continuity

The user confirms that releasing a threshold pull refreshes the data. The defect is presentation: only a text label descends over stationary action rows. Preserve the functioning read lane and repair the interaction's visible feedback.

- Pulling at the mobile List top moves its content with resistance while the header, footer and scroll viewport remain stationary.
- A recognizable refresh indicator occupies the revealed space above the first row; it does not overlay row content or add floating instructions.
- A short or cancelled pull returns without a read. A threshold release requests exactly one existing coordinator read and retains a compact busy presentation until that read settles.
- Success and error restore the normal content position. A manual or foreground read does not pull content down.
- Tracking has no easing lag; return motion respects reduced-motion settings. Native scrolling does not acquire application transforms or repeated geometry work.
- Screen/lifecycle changes and disposal clear presentation, and stale completion cannot revive it.
- Preserve row/whitespace gestures, click suppression, retained input, unknown operations and the Refresh button.

Native iOS compositing and physical touch acceptance are not established by Chromium.
