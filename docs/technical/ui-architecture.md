# UI responsibility and dependency boundaries

The dedicated UI separates data-only decisions, application state transitions, component rendering, and host/DOM effects. `lib/ui/client.ts` is the composition root: it creates the model instances and connects the controller, view, tool client, host transport, and DOM adapter. Typed occurrences and the readonly `get_selection_context` projection live in the model/controller boundary; the DOM adapter registers the local App tool while the host adapter owns trusted bidirectional JSON-RPC dispatch. Ordinary completion writes use the current confirmed revision directly; their committed `changedIds` and returned snapshot determine cascade draft baselines and completion feedback. Explicit preview remains available, and other autosaved changes continue to use preview when they need validation or resolved values.

## Development principles

These rules apply to new UI features and refactors as well as the current implementation.

1. **Separate decisions from execution.** Put filtering, ordering, validation, labels, control availability, view projections and state-transition decisions in deterministic, nonmutating model functions. Pass time, IDs and other environmental values explicitly; do not hide concrete capabilities inside model inputs or callbacks.
2. **Give state one user.** Application code owns published state and normalizes dates, picker selection, movement choices and acknowledgments before publication. Rendering must not initialize drafts, dispatch state changes or repair state through helpers in its call graph. Express focus and other required view effects explicitly and execute them at the effect boundary.
3. **Share components through explicit contracts.** Reuse outline and inspector rendering for Action, Project and Tag where their interaction contracts match. Components consume readonly view data and callbacks, render through injected DOM references, and retain only local rendering caches. They must not read controller state or initiate host/API calls directly. Keep entity-specific decisions in model projections instead of accumulating hidden policy in a generic component.
4. **Keep data types authoritative.** Define shared state and projection types in the model. Derive narrower component inputs with readonly types, `Pick` or `Omit`; do not duplicate DTO schemas. Keep callback-bearing requests and effect capabilities out of public data-only state.
5. **Compose effects at entry points.** Ports describe required capabilities; adapters implement them; the composition root connects them. DOM geometry, focus, capture, timers and host communication remain effects even when a component or application operation triggers them.
6. **Preserve interaction contracts.** A structural refactor must retain occurrence identity separately from entity IDs, compatible DOM nodes, focus/caret/IME behavior, unsaved proposals and exact request identity for unknown-outcome recovery. A passing projection test alone cannot establish these browser-facing guarantees.
7. **Enforce boundaries as the tree grows.** Place every new module in a declared layer and keep imports in the permitted direction. Extend the real-config lint fixtures whenever a new extension, import form or capability is introduced. A boundary change must update the responsibility contract and its tests; moving code or suppressing lint does not resolve a responsibility violation.

Use the [test allocation principles](testing.md#test-allocation-principles) to choose the evidence for each responsibility. The source tree below is the current implementation of these principles, not a requirement to keep unrelated responsibilities in a single file.

## Host safe-area layout

`model/display.ts` validates `safeAreaInsets` as one complete set of finite, nonnegative top/right/bottom/left numbers. `effects/dom.js` applies that accepted context to root CSS variables and invalidates cached gesture geometry when any effective inset changes. Missing insets use zero, and a valid all-zero update clears a previous host value. Malformed updates leave the last valid context in place.

The widget uses the browser-assigned viewport and applies host insets once inside its border-box main region. At widths up to 850 CSS px, the main region is bounded to `100dvh`: its header and status/recovery footer remain in flex layout, while the list or open inspector owns the remaining scroll area. No fixed overlay covers the mobile header. The global header remains available in details; the inspector toolbar sticks inside its own scroll area. Opening details retains the list scroll position, and returning restores it. Row-movement edge scrolling targets this list scroller on mobile and the document on desktop. Desktop document scrolling and sticky inspection remain available.

The static SPA shell applies the browser's four `safe-area-inset-*` values once as body padding and bounds the iframe within `100dvh`. It does not add inferred top clearance or a fixed covering band. The embedded widget receives zero additional host insets from this shell. The shell surface and browser theme color use light `#fff` and dark `#1d1e23`. Browser geometry checks verify that header and footer remain visible and only the central region scrolls; actual iOS Home Screen compositor behavior requires device acceptance.

The refresh effect adapter coordinates the retained header button, foreground recovery and mobile pull-to-refresh through one in-flight `list_actions` read. A request while saving is deferred until the write lane is idle; refresh retains drafts and exact unknown write requests. Hidden-to-visible and blur-to-focus transitions share a foreground latch, so paired events do not duplicate reads. A persisted pagehide keeps the existing transport alive for back/forward cache restoration. A downward single-touch gesture starting at the top of the list shows pull/release feedback, refreshes only after threshold release, and cancels for sideways/upward movement, multiple touches or cancellation. Inputs, inspector, open menus and active row moves do not start pulls. The pure `model/pull-refresh.ts` owns direction, resistance and threshold decisions; the effect adapter owns touch events, lifecycle listeners and feedback. Refresh failures retain input and allow retry from the button or another pull.

## Source tree

```text
lib/ui/
├── client.ts                         composition root
├── ports.ts                          host, ID, and message effect contracts
├── application/
│   ├── changes.ts                    recent-change reads and the review mark for review views
│   └── controller.ts                 state transitions, normalization, orchestration
├── components/
│   ├── change-cards.ts               keyed change cards with claims, lines and Undo
│   ├── changes-panel.ts              Changes view rendering from typed feed data
│   ├── inspector-panel.ts            inspector rendering from typed view data
│   ├── rich-text.ts                  Title/Notes rich text rendering from typed nodes
│   └── outline-list.ts               outline rendering from typed row data
├── effects/
│   ├── diagnostics.ts                optional diagnostics port
│   ├── dom.d.ts                      DOM adapter type boundary
│   ├── dom.js                        generated-resource DOM events and rendering
│   ├── host.ts                       trusted bidirectional transport and display-mode adapter
│   ├── review-mark.ts                browser-storage review mark with in-memory fallback
│   ├── tool-client.ts                tool request/response adapter
│   └── verification.ts               response-discard verification adapter
└── model/
    ├── autosave.ts                   pure save planning and acknowledgment
    ├── catalog-drafts.ts             pure Project/Tag draft state
    ├── catalog-tree.ts               pure catalog occurrence projection
    ├── changes.ts                    pure change descriptions, filters, review counts and Undo reasons
    ├── controls.ts                   pure control availability decisions
    ├── date-input.ts                 pure calendar/date input decisions
    ├── display.ts                    pure display and host-context data
    ├── drafts.ts                     pure action draft state
    ├── gesture.ts                    pure gesture and interaction transitions
    ├── icons.ts                      static icon markup
    ├── interaction.ts                pure typed occurrence selection and interaction state
    ├── movement.ts                   pure movement decisions and indexes
    ├── navigation.ts                 pure view and picker navigation
    ├── operations.ts                 pure operation, recovery, and committed completion feedback
    ├── picker.ts                     pure picker filtering and ranking
    ├── presentation.ts               pure text and presentation helpers
    ├── rich-text.ts                  pure Markdown-subset parsing and link safety
    ├── selection-context.ts          confirmed selection projection and Action eligibility
    ├── save-status.ts                pure save-status projection
    ├── transient-create.ts           pure temporary creation state
    ├── tree-drop.ts                  pure tree-drop decisions
    ├── types.ts                      data-only UI state and snapshot DTOs
    ├── ui-projections.ts             deterministic row, inspector, and chooser DTOs
    └── view-state.ts                 pure view and acknowledgment decisions
```

## Dependency direction

| Source | May depend on | Must not depend on |
| --- | --- | --- |
| `model/` | `model/`, pure `lib/domain/`, data-only standard values | `ports.ts`, `application/`, `components/`, `effects/`, DOM or host capabilities |
| `ports.ts` | `model/` data types and other port declarations | `application/`, `components/`, `effects/` implementations |
| `application/` | `model/`, `ports.ts`, other `application/` modules | `components/`, `effects/`, browser globals, direct host communication |
| `components/` | `model/`, other `components/`; injected `Document` and element references for local rendering | `application/`, `ports.ts`, `effects/`, ambient browser globals, host communication |
| `effects/tool-client.ts` | `model/`, `ports.ts`, pure `lib/domain/`, its own module | `application/`, `components/`, other effects and ambient browser globals |
| other `effects/` | `model/`, `ports.ts`, `application/`, `components/`, other `effects/` | — |
| `client.ts` | all UI layers to construct the runtime | — |

`model/types.ts` carries serializable UI state and result DTOs only. Private callback-bearing unknown requests are retained inside the controller and projected to callback-free public state. Ports describe capabilities outside the pure model; the model never imports a port or adapter.

## Enforcement and limits

`eslint.config.mjs` applies the `architecture/dependency-direction` rule across `lib/ui/`. It covers `.ts`, `.tsx`, `.mts`, `.js`, `.jsx`, and `.mjs` modules, resolves local extensionless paths and `@/` aliases, and checks ordinary imports, type imports (including inline `import()` types), import-equals declarations, re-exports, `require`, and dynamic imports. The restricted tool-client edge applies to these extensions as well. Application and component files are checked for concrete ambient effects such as global `window`, `document`, `fetch`, `Date.now`, `Math.random`, timers, browser storage and host APIs. Components are DOM renderers: they may mutate only the `Document` and elements passed to them, while ambient DOM access and host communication remain in `effects/dom.js`. The model also rejects named DOM and host capability types. `effects/tool-client.ts` has a narrower dependency rule than the other effect adapters and can depend only on the model, ports, pure domain, and its own module. Any source file added directly under `lib/ui/` must first be assigned to a layer; unclassified paths fail lint instead of becoming unrestricted.

`tests/harness/architecture-fixtures.test.mjs` runs positive and negative fixtures through the actual repository ESLint configuration. The fixtures exercise model-to-component and model-to-port type dependencies, component-to-controller re-exports, controller-to-DOM re-exports and non-static dynamic imports, ambient browser effects, new sibling application paths, and unclassified UI paths.

These checks enforce the repository's concrete closed module architecture and enumerate common ambient capabilities. They are not a proof that arbitrary JavaScript is effect-free; review and tests remain necessary when adding a new runtime capability or changing a boundary.

## Collaboration UI

The action detail request form and the Collaboration view's suggested work share the existing controller write/recovery lane; there is no separate list-wide collaboration overview. The pure collaboration projection derives labels and available decisions from readonly snapshot state. Components preserve keyed feedback inputs across refresh; the controller owns request/feedback/outcome and version-bound proposal-edit drafts and retains them through conflicts and unknown outcomes. A reply that loses an already-advertised collaboration capability is rejected rather than silently clearing state.

The UI displays acceptance as requested/not started until a start report arrives. Results never check off an action. Withdrawal while running requests a stop and retains the last reported state. Unknown outcomes remain visible even after withdrawal; explicit reconciliation requires a written observation and selected outcome. Clipboard handoff includes IDs, version and scope, with a manual-copy fallback. It is not an agent-launch API.

UI model/application modules may use type-only imports from `lib/data/types.ts`. Dependency lint still rejects runtime data imports and storage/adapter imports; fixtures exercise both the allowed type boundary and forbidden effects.

Each card shows the delegation target in its selector, who started the work and when it last reported, and lets the person change the target among any AI and the clients the snapshot names; the change is sent as one `assign` write through the controller lane. `model/collaboration.ts` parses the human-facing proposal fields, report summary, remaining work and the person's latest instruction into the shared Markdown subset and assigns each decision a slot: Approve or adoption as a labelled primary button beside the delegation selector, revise and respond as the send icon of the one-line reply composer, cancelling approval as a stop icon in the card header, and outcome reconciliation beside its outcome selector. Empty fields have no row. Edit proposal, Copy request for AI and History are icon-only header controls. Proposal cards show up to three retained alternatives for the selected Action, including cancelled approvals. Approving a card selects it; other approval controls are unavailable until cancellation and unresolved-run reconciliation. There is no rejection button. Direct editing retains all six proposal fields in controller state with the original version. Save explicitly clears approval; conflicting refreshes preserve unsaved fields. Components retain keyed editor nodes and never create drafts during rendering. Remote MCP notifications concern connected AI clients; the SPA continues to use its existing shared controller paths.

## Views by intent and change review

The widget lands on Inbox. One view rail lists Collaboration, Inbox, Flagged, Projects, Tags, Changes and Done & dropped, plus saved perspectives by name: on wide layouts a sticky 56 px column of icon-only buttons whose names are their tooltips and accessible names, with number badges for what waits on the person in Collaboration and new connection changes; on narrow ones a labelled panel disclosed below the header by tapping the current view's title (`aria-expanded`/`aria-controls`; Escape, choosing a view or pointing outside closes it and returns focus to the toggle). The header shows the current view's name and icon as a plain heading, and a perspective shows no conditions summary. When the host advertises `hostCapabilities.experimental.signOut`, as the web shell does, Sign out ends the rail and sends `web/sign-out` to the host; other hosts show none. Changes is a review view without an Action outline; the outline's selection and movement controls are hidden there, while save status, unknown-outcome recovery, retained proposals and the inspector stay available.

Collaboration is an ordinary Action list: the unfinished, nondeferred Actions (with the usual display choices) that hold at least one collaboration record, in list order. Open suggestions of new work that no Action holds yet render above it through the shared collaboration panel with their adoption choices, and only in this view. `model/collaboration.ts` derives each row's status from its records: the most urgent of alert (stop requested or outcome unknown), reply, result, proposal, running, requested, external wait, revising, deferred, stopped and declined, shown as one icon named by the record's label. Waiting on the person is the attention tone, AI work and proposals the accent tone, and the rest muted; a completed or dropped Action is always muted. The rail badge counts the records waiting on the person. `documentTitle` names the document after the current view with that count in front; a host advertising `hostCapabilities.experimental.title`, as the web shell does, receives the same text through `web/title` and appends its configured application name. Action text never enters the title.

Changes reads `list_recent_changes` through `application/changes.ts`, which reloads whenever the confirmed revision changed, so the Changes badge stays current in every view, ignores responses to superseded requests and keeps the last confirmed list when a reload fails. `model/changes.ts` turns persisted before/after records into plain-language lines, shows the writer's summary as its claim, filters by the person or connections, groups by local day and explains unavailable Undo. Undo of a listed save goes through the controller's serialized write lane with exact unknown-outcome recovery.

The review mark is the newest revision the person marked as reviewed. `effects/review-mark.ts` keeps it in browser storage, falling back to memory when storage is absent or throws, as in sandboxed host frames. It is per browser and is never sent to the server. A mark beyond the loaded head is ignored as belonging to another account or timeline. Connection changes after the mark count as new.

The inspector follows the [visual policy](../design/design-ui-visual-policy.md). One toolbar row holds the icon-only lifecycle choices Open, Waiting, Done and Dropped, Flag, the Edit/Done toggle and Close; on narrow layouts Back replaces Close. Under the title, property chips show the Project, Deadline, Hide until and Tags of the current draft; an unset chip is icon-only. Deadline and Hide until each open an inline editor from their chip, tracked as the `due` and `defer` picker kinds, with quick dates that feed the existing date inputs; Escape or a press outside closes it. The chip label comes from the draft pair, so partial raw input stays visible as typed. A single line shows who added and last changed the Action when the snapshot carries provenance. Controls whose meaning is visible carry no explanatory text.

On narrow layouts Action List and Action Detail are separate pages. Opening the inspector hides the list content and the list header but keeps save feedback, retained proposals and unknown-outcome recovery; the DOM adapter starts the Detail page at its top and restores the list scroll position on Back, after which focus returns to the row.

Action rows mark proposals still awaiting the person (pending, deferred or in revision, not started) with a Proposal icon before other badges; approved or running work shows a collaboration icon named by its status label. Waiting, Later, Done and Dropped are icon-only badges named by their text; the deadline shows its date with a spoken "Deadline" prefix; parent, Project and Tags follow as muted text. Wide rows keep the title and badges on one line and truncate the title. Rows have no separate move handle. On touch and pen, `model/row-press.ts` decides a press: inside a 10 px slop it stays pending, a mostly sideways move becomes a swipe, and any other move is left to scrolling (`touch-action: pan-y`). A rightward swipe on an unfinished Action chooses Done and, further along the same direction, Dropped; a leftward swipe opens the Action with the AI request field focused when collaboration is available; a direction that is not allowed only resists. A press held for 500 ms lifts an Action, Project or Tag row: moving it starts the ordinary drag, and releasing it in place opens the Move chooser. The trailing tap after a swipe or hold is swallowed, and the complete control stays available to assistive technology while visually hidden on coarse pointers. With a mouse, rows drag as before; right-click and the keyboard context-menu key open the Move chooser for the row. Swipes write through `controller.direct` with the ordinary receipt and Undo path.

