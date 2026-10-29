---
change: change-20261029-proposal-selection-events
role: requirements
---

# Requirements

The user requested up to three proposals, human selection and editing, no rejection, retained proposals after approval cancellation, and MCP events. The user confirmed that events mean notifying connected AI clients when the person approves, edits or cancels approval in the UI.

- Given an Action with fewer than three proposals, a caller can add another proposal without replacing existing proposals. A fourth is refused, including concurrent attempts. Retained withdrawn/rejected legacy records count toward the cap; edit existing proposals instead of silently deleting them. Existing records are never pruned to enforce the limit.
- Given several proposals for an Action, the person can choose one by approving its card. At most one approval exists for that Action. Other proposals remain visible and editable. Selection of another requires cancellation of the current approval.
- Given a proposal, the person can directly edit its title, instructions, scope, expected outcome, exclusions and source. Saving increments its version and clears approval. Unsaved changes survive refresh, conflict and unknown-result recovery; stale edits are not silently rebased.
- Given an approved proposal, cancelling approval keeps the same proposal visible and returns its decision to pending. If work is running, cancellation requests a stop; a different proposal cannot be approved while work or an unknown outcome is unresolved. Cancellation does not assert external cancellation.
- No new rejection operation or rejection button is offered. Legacy rejected records remain readable and editable. No proposal operation completes the Action.
- Given a valid authenticated MCP subscription, UI approval, editing and cancellation cause a standard resource-updated notification. The client reads current shared state before continuing. Notifications neither start AI work nor grant external permissions.
- Given a disconnect, the client reconnects with its last received event cursor. Wrong-user, malformed, expired or future cursors are rejected. Revoked access ends delivery. A subscriber connected to another API instance still observes committed changes.
