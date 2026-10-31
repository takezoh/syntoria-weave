---
change: change-20261031-contextual-feedback
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

## Responsibility-local implementation

The prior DOM adapter wrote unrelated read/save/operation messages to one footer and replaced the Refresh icon with save-state icons. This mixed provenance and made global reserved space the owner of recovery.

The controller now owns typed read status, identity-bearing operation/advisory notices, pending Undo and recovery disclosure. A pure feedback projection derives pane placement, draft targets and eligibility; a reusable component patches stable contextual nodes. Refresh retains read provenance independently of saves. Unknown writes retain exact arguments through Check and Retry, and authoritative unknown feedback suppresses duplicate failure messages.

List, Action Detail and Catalog Detail own in-flow feedback hosts. Persistent toolbar controls expose offscreen Action and Catalog drafts. Standard navigation uses wrapping visible names. No footer or idle footer reservation remains.

Undo has explicit lifetime and operation identity guards. Failed Undo keeps its notice and conflict; pending Undo disables duplicate dispatch. Dismissal does not erase lastOperation or Changes history. Known valid Action draft failures have an explicit Retry changes callback, while conflicts keep the existing choice and unknown writes keep exact replay.

The DOM adapter defers geometry-changing feedback updates through claimed gesture settlement. It does not remount text fields or move focus on automatic publication. Explicit recovery activation may focus and scroll its contextual target. Verification-discard feedback is a typed application event.

No backend, API, persistence, authentication, dependency or deployment-resource change is included.
