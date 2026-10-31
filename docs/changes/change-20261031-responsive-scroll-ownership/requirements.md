---
change: change-20261031-responsive-scroll-ownership
role: requirements
---

# Responsive viewport and named navigation

Desktop and tablet users must be able to read and select saved perspective names. Tablet List and Detail content must scroll without moving the header and recovery footer out of the viewport.

- The widget owns a bounded viewport at every width. Main chrome remains in layout, and the workspace receives remaining height.
- List, navigation and visible detail content each own their scroll area and their positioned descendants. Breakpoints select column/page placement, not the scroll owner.
- Built-in functions remain recognizable icon controls. Named perspectives receive a readable sidebar width, natural wrapping, selected state and keyboard access; hover text is not their only readable representation.
- Long names must not expand the compact header. The sidebar provides full names while the header may truncate its current title.
- Wide inspection preserves independent list/detail scrolling. Narrow List/Action/Catalog page switching, Back behavior, input/IME and unknown-operation retention remain intact.
- Mouse edge movement targets the list scroller in all layouts. Native touch scroll, row gestures and pull feedback remain available under their existing eligibility rules.
- Do not solve device-specific symptoms with another overriding media rule or inferred status-bar dimensions. Consolidate layout responsibility and remove contradictory declarations.
