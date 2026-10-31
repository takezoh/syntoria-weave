---
change: change-20261031-search-default-active
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

## Decisions

- `navigation.present` runs the existing Title/Notes matcher, then applies `displayFilter` to matched rows. The UI does not recalculate inherited Defer or expiry.
- `search.open` initializes status selection to active/on-hold and Defer false. The existing cloned return navigation remains the source for restoration on close.
- Search Display choices dispatch a local `view.navigation` patch and render. Other views retain their existing navigation path. Blurring an editor into Search's Display menu does not force a flush.
- The window Escape handler honors `defaultPrevented`, so a menu's Escape dismissal is not followed by Search close.

## Changed responsibilities

`lib/ui/model/navigation.ts` owns matching and filter projection. `lib/ui/model/view-state.ts` owns Search defaults and navigation restoration. `lib/ui/effects/dom.js` owns the view-only menu effect and keyboard priority. The existing outline projection continues to own row, selection and movement visibility.
