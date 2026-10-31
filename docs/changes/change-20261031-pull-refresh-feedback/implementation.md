---
change: change-20261031-pull-refresh-feedback
role: implementation
---

# Presentation ownership

The gesture arbiter continues to own contact intent and threshold release. The application refresh coordinator continues to own the single read lane. Pull presentation consumes those signals through a pure state projection and a dedicated DOM effect; neither gesture handling nor the controller owns loading animation.

A content track moves within the stationary List viewport and reveals the refresh indicator above existing content. Compatible action nodes are retained. Presentation follows the actual refresh lifecycle instead of hiding immediately on release or inferring completion from a timer.

The prior label-only implementation failed the new browser assertion that a subthreshold pull displaces the first row. Delayed-response browser checks additionally distinguish tracking, pending refresh, success, error and return behavior.
