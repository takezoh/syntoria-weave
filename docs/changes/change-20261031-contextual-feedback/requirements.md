---
change: change-20261031-contextual-feedback
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

## Required outcomes

- Show visible standard navigation names at every width and reserve no idle footer space.
- Separate typed read state from save recovery and operation outcome state.
- Keep exact unknown requests and retained Action/Project/Tag edits reachable across navigation.
- Preserve untimed Undo until matching dismissal, replacement or successful Undo; keep Changes history.
- Preserve editor nodes, focus, caret, IME and bounded independent scrolling when feedback changes.

The evaluated [UX plan](requirements-plan.json) and [architecture contract](architecture-plan.json) define the six witnesses and responsibility boundaries. Backend, API, database and authentication contracts are outside this change.
