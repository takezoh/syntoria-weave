---
change: change-20261029-plugin-collaboration-guidance
role: implementation
---

# Implementation

Bump plugin metadata to 1.1.0 and describe reviewable AI proposals. Expand both operation and guide skills, add a bundled collaboration reference, and link it from operation recovery guidance. Separate proactive reminders from resource change notifications and distinguish direct-client SSE instructions from ChatGPT host-owned subscription behavior. Correct stale discovery and perspective summaries while reviewing the same capability guide.

The manifest retains its required registered-app dependency and empty mcpServers. No backend or database behavior changes are needed. The local and known host checkout have no rendered plugin-settings.json, so the generated package is explicitly a noninstallable template; do not invent a registered app ID.

Combined verification exposed a teardown-only asynchronous 57P01 error in the earlier migration test. Its additional pools now use the existing fixture's closing-state error policy: suppress only expected administrative shutdown after teardown begins, while propagating other pool errors. No production code changed for this correction.
