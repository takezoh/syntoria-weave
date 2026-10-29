---
change: change-20261029-action-collaboration
role: requirements
---

# Requirements

The user authorized implementation in the current session. The source brief is `.orca/drops/weave-collaboration-design-brief-ja.md` (local input). This package implements shared business intent and observed reports; it does not create an execution authorization service.

| Scenario | Observable acceptance |
| --- | --- |
| S1, S9: human work | Given an ordinary action, the person can edit or complete it without a proposal. A report never completes that action. |
| S2: existing work | Given a saved action, an authorized caller can attach one current proposal with original instructions, scope, outcome, exclusions and source. |
| S3: direct request | Given a saved, clean action, entering instructions and requesting assistance saves an accepted, unstarted request. Copyable handoff text identifies the action and collaboration. |
| S4: handoff | Given a running report, a caller can record a question for the person or an external wait. A human response retains the same run. |
| S5: external effects | Accepting a scope records work intent only. External authentication, authorization and effect approvals stay with Gate and the caller's environment. |
| S6: decisions | Decline, defer and revision requests leave the action unchanged. Revised scope increments proposal version and requires a new decision. |
| S7: inactive caller | Acceptance displays requested/not started. No scheduler or agent startup is implied. |
| S8: outcomes | Success, partial, failed and unknown reports remain distinct. Unknown or running work blocks replacement. Explicit verified reconciliation records evidence without asserting an external cancellation. |
| S10: concurrency | User-wide CAS and proposal version reject stale changes; current-run reports are tied to the starting connection. A missing response retains exact arguments for receipt lookup/replay. |
| S11: suggested work | A proposal without an action does not create a commitment. Adoption creates or links an action; creating an action and delegating are separate choices. |

The UI preserves unsaved feedback and request text through refresh, conflict and unknown-result recovery. It shows scope, source, exclusions, results, remaining work, artifacts, next actor and recent history. Explicit reconciliation records the responding caller separately in history and preserves the original run identity. External runners must reread state and enforce their own effect permissions; these records cannot prevent an independently running process from acting.
