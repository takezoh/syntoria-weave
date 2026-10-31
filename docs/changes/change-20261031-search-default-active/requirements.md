---
change: change-20261031-search-default-active
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

## Behavior

- REQ-1: A fresh Search opens with `active` and `on-hold` selected, Defer excluded, and an empty query. Matching uses the existing literal NFKC Title/Notes semantics.
- REQ-2: The existing Display menu offers `active`, `on-hold`, `completed`, `dropped` and `deferred` while Search is open. Status selection intersects with effective Defer visibility, including inherited Defer and read-time expiry already supplied by the snapshot projection.
- REQ-3: Filtering is applied in the shared draft-aware outline projection used for rendering, selection and movement. Title/Notes proposals remain searchable and raw.
- REQ-4: Search Display changes do not read, save, flush drafts, clear the query, or replace the inspector. A fresh Search open resets Search filters; query edits, clear and result navigation retain them; close restores the exact prior view settings.
- REQ-5: Escape dismisses an open Display menu before it can close Search.

## Boundaries

No backend, schema, persistence, new filter state, or caller workflow behavior changes.
