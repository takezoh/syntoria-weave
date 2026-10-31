---
change: change-20261031-responsive-scroll-ownership
role: implementation
---

# Layout ownership

The component-layer layout stylesheet is the single owner of viewport bounds, workspace columns, chrome, navigation dimensions and content scrolling. The HTML composer consumes it and retains component presentation styles. Competing legacy container rules are removed instead of overriding them again.

Main height is bounded at every width. Its header and footer remain outside the scrolling workspace. The list and detail content use independent bounded scrollers; the detail scroller also establishes the containing block for absolute accessibility labels, preventing those descendants from increasing document height. The outer shell continues to own browser safe-area insets.

Navigation groups built-in icon functions separately from named perspectives. Wide sidebars provide 220px, or 208px in the intermediate layout, and names wrap within their buttons. Narrow layouts retain the labelled disclosure. The header title shrinks without moving its controls onto another row.

Drag edge geometry and scrolling use the list container in every layout. The existing gesture arbitration, refresh lane, draft model and write recovery remain unchanged.
