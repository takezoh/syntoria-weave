---
change: change-20261031-action-search
role: implementation
---

## Accepted architecture

The independently reviewed [architecture plan](architecture-plan.json) defines one bounded UI change: pure matching and shared outline projection; controller-owned query/return navigation, selection and recovery; DOM-owned input, composition and focus. The user approved the global title/Notes UX.

The controller publishes one readonly outline shared by rendering, visible selection and movement choices. Search keeps raw draft overlays, all lifecycle states and canonical Action order, while returning flat unique matches. Perspective evaluation retains confirmed-snapshot semantics. Hidden explicit selection is pruned independently of the retained inspector. Search performs no persistence or per-keystroke reads.

## Implementation

The shared header now exposes a named Search control and a native search input with accessible clear/close controls and a live result status. Opening Search saves a cloned navigation state; close restores it, while choosing another view exits to that view. The controller publishes the shared pure outline projection to rendering, visible-selection pruning and move choices. Search matches Title or Notes separately after query-edge trimming, Unicode NFKC and lowercase normalization; whitespace-only input produces a no-results state. Search is local and makes no query-time read or write.

The projection preserves canonical source order, unique Action IDs, lifecycle/Defer cues and flat parent context. It searches current raw Title/Notes drafts and nonempty local proposals, without mutating confirmed data or promoting catalog, collaboration, metadata or provenance text into searchable fields. Perspective views continue to project the confirmed snapshot. A selected inspector target remains retained even when it no longer matches. On narrow layouts Search opens the list while retaining that target; selecting the same or another result opens Detail, and Back returns to the Search list.

The DOM owns input composition and focus, while Search view/query/return-navigation and narrow Detail visibility remain application model state. Menu closure, clear, query, close and Escape do not trigger a persistence operation or refresh. Existing result selection and Back keep their ordinary autosave/flush behavior.

## Implementation status

Implementation, local `pnpm check`, exact-source build and synthetic browser acceptance of the final artifact are complete. The full check passes all 738 tests with lint and typecheck; the preceding focused UI run passed 301 tests. The local browser acceptance covered desktop/narrow geometry, lifecycle and Unicode results, Search/Detail navigation, retained drafts and exact unknown-write replay. Actual-host acceptance and deployment were not attempted.
