---
id: design-product
kind: design
title: Syntoria Weave Positioning, Audience and Benefits
status: active
created: '2026-10-02'
updated: '2026-10-09'
summary: 'Shared state for humans and AI consumers: positioning, everyday action use,
  caller responsibilities, the implemented Change Cursor API and its claim boundaries.'
tags:
- product
- benefits
- gtd
owners: []
relations:
- {type: references, target: design-assistance}
- {type: references, target: design-action-state-and-perspectives}
- {type: references, target: note-20261002-gtd-benefits-and-llm-research}
- {type: references, target: note-20261002-state-and-view-design-research}
- {type: references, target: note-20261003-llm-delegated-task-management-and-plugin}
- {type: references, target: note-20261003-product-positioning-audience-and-claim-b}
- {type: references, target: note-20261004-outcome-first-messaging}
source_paths: []
scope_type: system
responsibilities:
- id: RESP-001
  statement: Design human and caller-side AI collaboration over Weave's persistent
    state and operations, starting from user benefits.
invariants:
- id: INV-001
  statement: Caller-side LLMs own assistance decisions; do not assume Weave contains
    an independent LLM decision engine.
  enforcement: review
- id: INV-002
  statement: Distinguish product direction, accepted MVP contracts, extension hypotheses
    and measured results.
  enforcement: review
boundaries:
  provides:
  - Product purpose and design criteria
  consumes:
  - User discussions
  - settled MVP requirements
  - research with verified sources
  forbidden:
  - Using GTD procedures or task completion counts as substitutes for benefits
  - recording concepts as implemented or proven
variability:
  fixed:
  - Benefit priority
  - division of responsibility with caller-side LLMs using Weave
  - respect for user corrections and choices
  free:
  - Specific prompt wording
  - workflows or parameters for selecting and validating benefits
capabilities: []
failure_responsibilities:
- Separate plugin defects from caller workflow defects and evaluate total burden without
  false reassurance.
trust_boundaries:
- Distinguish LLM inferences from user intent; determine save success from operation
  results.
compatibility_policies:
- This design does not change existing MVP C1-C4 or Work acceptance scope.
---

# Syntoria Weave Positioning, Audience and Benefits

## Positioning

**Keep less in your head. Your AI keeps track of the rest.**

Syntoria Weave is a shared state store through which AI/LLM consumers share state with humans and other authorized AI consumers. Everyday work and personal actions are its current concrete use: actions, original notes, containment, projects, tags, dates and perspectives remain available when the user changes a plan, switches conversations or uses another authorized workflow. Interpretation, recommendations and decisions belong to the consuming LLM; Weave persists, retrieves and validates the shared state within the authenticated user's boundary.

The intended outcome is less effort remembering, collecting, organizing, reviewing and updating everyday work and personal tasks, with more attention available for action, decisions and rest. Direct human corrections and another AI's saved results can inform the next interaction through the same state. Reliable writes and retained original input support delegation, while the management method remains in prompts. The user and their AI create the useful experience through these data capabilities.

Weave provides API/MCP tools and a dedicated UI over that shared state. The user's prompts, AI or caller-side scheduler determine how and when to use them. The service exposes HTTP API, Remote MCP and a Web UI; each client requires a supported authenticated route and its own acceptance evidence. The product name is Syntoria Weave, shortened to Weave after first mention. Source code and published identifiers are generic and contain no product name, so the name lives only in documentation and host listings.

### Place in Syntoria

Weave is Syntoria's State Store. Its subject is the state currently shared between the user and their authorized AI consumers: what is open, what waits on a decision, the original input, its context and the references back to its source. That state covers the relations and intent around the work as well: containment and classification say how actions belong together, and order, flags and dates say what the user meant to do with them. Weave keeps that state durable, validated and correctable, and makes the same records available to every authorized reader.

Weave owns its storage, API, history and change cursor, and releases and deploys on its own. It serves whatever authorized caller holds its credentials; a caller that works with other services alongside shared state composes them itself and decides how the results relate. An Action's state records what the person decided or finished; whether a delegated process has run is a separate fact kept in the caller's own records.

## Audience

| Segment | Role | Reason |
| --- | --- | --- |
| Individuals who use an AI assistant daily and want it to handle task upkeep, especially people for whom maintaining a to-do app became work in itself | Primary | They gain the most from not learning an app routine; because they will not supervise each change, safe writes are a precondition for delegating |
| GTD practitioners and people who run their own systems | Secondary | The method stays in their prompts while the saved data remains stable |
| People who build their own agents or scheduled workflows | Secondary | Composable tools accept changes from any authorized caller workflow |
| People who continue work across conversations and authorized AI workflows | Secondary | Current shared state and original notes preserve human corrections and saved results for the next read |
| Team project management, automatic calendar planning and reminder use | Not targeted | These are outside Weave's responsibilities |

People already settled in an established task app can use that app's AI connection, so they are not the primary audience. These segments are hypotheses, not validated market findings.

## Brand pillars and supporting contracts

| Pillar | Promise | Supporting contract |
| --- | --- | --- |
| Get it out of your head (entry) | Hand things over without deciding everything first | Exact original notes; no required deadline, classification or commitment; Defer preserves content and Due; Inbox keeps project-unassigned unfinished actions |
| Design a workflow that fits you (differentiator) | Design any workflow with the AI, such as GTD, a simple daily list or an own system, and change it without rebuilding the list | No backend management method; containment, projects, tags, order, flags, dates and perspectives are composable data capabilities |
| Let your AI do the upkeep (core experience) | The AI captures, clarifies, organizes and reviews inside the user's system | Composable reads, previews and changes through API/MCP; authorized caller workflows can write collected inputs |
| Continue from shared state | Human corrections and saved AI results are available to the next authorized consumer | Conversation and UI read the same user-scoped state; callers retrieve current snapshots and reconcile their own context |
| Stay in control—without watching every change (primary differentiator) | AI changes do not silently break the saved list, and the user can inspect and correct directly | Latest-revision validation rejects stale writes; the UI retains unsaved proposals; identical replay uses the receipt; unknown outcomes keep exact IDs and arguments for lookup or resend; Undo rejects later target corrections; user isolation; conversation and UI share one action path and saved state |

Lead with relief from remembering, then the appeal of designing a workflow with the AI. Use safe delegation and direct correction as reasons to believe. A pillar must not promise more than its supporting contract. New user-facing benefit text requires a matching row in the [Product](../../PRODUCT.md) `Value and approach` table naming the behavior that supports it; text without one is not published. Take impact from concrete scenes and specifics rather than from stronger claims.

## Messaging and tone

- Headline: "Keep less in your head. Your AI keeps track of the rest." Supporting line: "Design your own workflow with your AI—GTD, a simple daily list or something entirely new. It captures, organizes and reviews your tasks your way, while you stay in control."
- Repository description: "Share the current state of your work between you, your AI and other authorized AI workflows. Keep less in your head and stay in control." Lead it with the verb and the shared state; the State Store role name lives in README/PRODUCT and the repository topics.
- Present GTD as one example among several workflows, never as a built-in or default method.
- Write benefit-, outcome- and appeal-first. The user and their AI are the subjects of user-facing text; describe the combined experience rather than the data layer. Data-layer responsibilities and limits follow in a "How it works" section and technical documentation.
- Explain Weave as the shared state store for the user and their AI, with everyday actions as its current use. Show the value through a human correction, another conversation's saved result and continuing from current state. Sharing stored state does not imply automatically synchronized AI context or access across users.
- User-facing text says "AI" and "tasks". "LLM" and "caller" belong to technical and API documentation. Because the dedicated UI labels items "Action", user-facing text may introduce an action as the saved form of a task and keeps the GTD term "next action".
- Tone is calm, plain and honest. Avoid productivity hype; more tasks or completions are not success, and rest is a legitimate outcome.

## Claim boundaries

| Do not claim | Reason |
| --- | --- |
| Reminders, notifications, calendar planning or background execution | Caller and host responsibilities |
| Weave decides priorities or what matters | Weave has no backend LLM; the caller's AI and the user decide |
| No confirmation or approval is needed | Host confirmation steps are outside Weave |
| Every change can be undone | Undo rejects later target corrections and uses only the latest 100 retained operations |
| The AI never invents deadlines or commitments | Caller guidance, not backend enforcement; Weave stores requested changes |
| Works with any AI assistant | Only the ChatGPT delivery has been verified |
| A cursor marks human reading or updates every AI's understanding | Incremental retrieval is available, but each consumer owns its context and cursor; interpretation, reading acknowledgment and Action completion remain separate |
| Proven reduction of management effort | Intended outcome, not measured |

## Benefits and evaluation criteria

| Intended benefit | Burden reduced | Evidence to seek |
| --- | --- | --- |
| Get it out of your head | Rehearsing commitments and checking where they were saved | Less repeated checking without important information loss |
| Delegate upkeep | Collecting, classifying, updating and reviewing lists | Less total management time, including explanation and correction |
| Focus on the current purpose | Scanning every item and rebuilding context | Relevant actions and decisions are easier to retrieve |
| Design a workflow that fits you | Adapting personal habits to a prescribed app workflow | Different user-defined methods operate over the same data |
| Change methods without starting over | Rebuilding lists when prompts or routines change | Existing actions remain reusable across workflow changes |
| Continue across human and AI interactions | Repeating corrections and reconstructing saved decisions | The next authorized consumer reads current state and preserves human corrections and saved results |
| Stay in control without watching every change | Supervising AI edits and repairing uncertain saves | Less per-change checking, with direct correction, preserved proposals and safe recovery |
| Rest with confidence | Continuing to think about matters already entrusted to the system | Reassurance accompanied by low omission/error rates |

These are intended outcomes, not measured long-term effects. More tasks, completions or notifications alone are not success. Deferring, withdrawing a commitment and resting are legitimate outcomes. Evaluate total remembering, explanation, approval, correction and supervision burden, together with missed commitments and invented intent. Research in the [GTD note](../note/note-20261002-gtd-benefits-and-llm-research.md) informs evaluation but does not prove Weave's effects.

## Product boundary

| Weave provides | The user and caller determine |
| --- | --- |
| Shared, durable structured actions, projects, tags and perspectives within one authenticated user | Meaning, classification conventions, each consumer's context and management method |
| Composable reads, previews and changes through API/MCP | Capture, organization, review and recommendation workflows |
| Validation, deterministic transitions and ownership | What matters, what to delegate and when to ask |
| Revision, atomicity, receipts, replay and Undo | Execution opportunities, external-source access and notifications |
| A UI for the same saved state | Prompts, assistant choice and caller-side scheduling |

An agent configured by the user can inspect Slack or email using its own tools and write the resulting actions through Weave. This is a use of the published tools, not a separate Weave integration or backend monitoring feature. Availability and authorization of external access and scheduled execution belong to the caller's environment. Weave does not promise that the caller is configured or will run.

Thinness means flexible semantic decisions with reliable persistence, not arbitrary SQL or relaxed ownership. Backend restrictions must follow authorization, integrity, deterministic semantics or resource limits; assistance suggestions are not additional validation rules. See [architecture](../../ARCHITECTURE.md) and [caller responsibilities](assistance.md).

## Change Cursor API and adoption history

Status (2026-10-14): the bounded cursor API was adopted and implemented. The original proposal below records its design rationale and the questions open at proposal time. The current contract is in [MCP/API](../technical/mcp-api.md#current-reads-and-incremental-changes); the implementation decisions are summarized at the end of this section.

### Purpose and value

The 2026-10-09 proposal described a simple API to retrieve changes after a supplied cursor and return the next cursor. Its purpose was to let each consumer ask what changed since its own previous reference point. Shared state can change while different AIs retain different versions in their working context. At proposal time, tools returned full snapshots or filtered current state; the proposed API would provide incremental reads.

The value is in human and AI collaboration: a human's correction becomes an input to each AI's next review; another AI's saved result can inform subsequent work; a consumer can use changes to identify assumptions worth reconsidering; and a resumed session can update retained or restored context from its reference position. Reduced repeated full reads and comparison work support these outcomes. A small data change can still have a large effect on a decision.

### Proposal-time API sketch

| Responsibility | Proposed contract |
| --- | --- |
| Current position | Weave can return a cursor representing the current change position |
| Incremental retrieval | A supplied cursor returns subsequent changes and the next cursor |
| Pagination and empty results | Continuation is explicit, no unread range is skipped, and no-change results are distinguishable |
| Opaque cursor | Consumers store and reuse the value without interpreting its internal format |
| Independent consumers | Separate consumers, conversations and workflows retain their own positions; model name alone does not identify a consumer |
| Processing and recovery | The consumer saves its position after required processing succeeds and handles re-fetches and duplicates safely |
| Interpretation and decisions | The consuming LLM or application interprets changes, obtains additional context and decides whether to revise a judgment, act or notify |

The returned cursor identifies a retrieval position. It does not prove correct understanding, mark a human's reading progress or complete an Action. Reading changes does not itself mutate those business states. A cursor alone cannot reconstruct past conversational context: the caller must retain or recover that context and know the position it was based on.

Begin with consumers storing their own cursors; Weave-side per-consumer checkpoint storage is not a prerequisite. Shared storage and change retrieval retain the current user and authorization boundaries. They do not add assistant messaging, execution ownership, orchestration, push delivery or a Weave decision engine.

### Questions at proposal time

- Define the relationship to existing revision without assuming a new independent counter.
- Inventory affected data, including Actions, Projects, Tags, Perspectives and relationships, and define the supported scope rather than assuming Action-only changes.
- Choose record granularity, coalescing and whether consumers receive changed attributes, before/after values or current objects. Complete event sourcing, every intermediate state and indefinite history are not requirements.
- Define initial acquisition, a consistent starting position, pagination, re-fetching, cursor scope, retention/expiry and authorization changes.
- Decide where the consumer's processed position is persisted and how a failed processing attempt resumes safely.

An unchanged store does not mean a decision can remain unchanged. Defer expiry and approaching deadlines depend on time and still require separate caller evaluation.

The source is the registered [Draft item 266668064](https://api.github.com/users/takezoh/projectsV2/5/items/266668064) in the [Weave GitHub Project](https://github.com/users/takezoh/projects/5). The proposal-time questions are resolved by the adopted bounded contract below. Local implementation and acceptance do not establish hosted deployment or host behavior.

### Adopted bounded contract

| Design question | Current decision |
| --- | --- |
| Position source and cursor scope | Reuse user-wide `operations.revision_after`; encode a canonical versioned opaque cursor with a domain-separated fingerprint of the live trusted user. The token never selects a SQL user and stores no consumer identity. |
| Bootstrap | Every complete snapshot returns `change_cursor` at the same consistent PostgreSQL snapshot revision and raw `action_tags`; filtered query results are not bootstrap snapshots. |
| Record shape | Return each retained operation with before/after persisted DTOs for Actions, Projects, Tags, Perspectives and Action/Tag associations. Include create/edit/remove/Undo changes. Withdrawal remains a `dropped` Action status; it does not physically delete Actions. |
| Pagination | Default 20, maximum 100 whole operations and a 1 MiB UTF-8 JSON limit on the logical ChangePage. MCP returns the page in both `structuredContent` and `content[0].text`, so the full JSON-RPC HTTP response body may be larger; there is no total wire-body limit. Split pages carry the observed head fence. Empty and terminal pages reset to a live cursor at the observed head, so later operations remain visible. |
| Retention and invalid history | Reuse the existing latest-100 operation window. Expired positions return `cursor_expired`; malformed, future, wrong-user and discontinuous history fail explicitly. Resynchronize with a fresh complete snapshot and its cursor. |
| Consumer responsibility | Each caller stores its own cursor and advances only after applying a page. Reads do not mutate state or acknowledge that a human read, understood or acted on changes. |

Snapshot bootstrap and feed reconstruction use the shared explicit persisted DTO projection. Derived display values, user values and internal identity markers stay outside the canonical persisted cache and feed. No new revision counter, checkpoint table, migration, event-sourcing contract, or user-wide state replacement is introduced. See the current [data model](../technical/data-model.md#atomic-writes-replay-and-undo) and [MCP/API](../technical/mcp-api.md#current-reads-and-incremental-changes).

## Management methods and data structure

GTD is one possible caller-side management method. A user may follow it, adapt it, or use another approach. Weave does not mandate or reject GTD routines, fixed review schedules or the two-minute rule. It provides the data capabilities needed to represent supported state and leaves their use to the user and LLM.

Weave provides containment, projects, tags, order, direct flags, dates and perspectives as structured data capabilities. Actions have containment only; there are no prerequisite edges or sequential/parallel execution constraints. Data and deterministic projection semantics remain stable across management methods. See the [current state design](design-action-state-and-perspectives.md).

## Current contract, history and development

[Data model](../technical/data-model.md), [API](../technical/mcp-api.md) and code define supported operations. Completed change packages and [historical research synthesis](../research/product-brief.md) describe their recorded versions, not current inventories. The [Work acceptance record](../note/note-20261002-work-benefit-acceptance.md) does not establish acceptance of subsequent changes or user-defined workflows.

Develop from benefit and caller scenario to required data capability and evidence. If a scenario can already be composed from tools, document the use rather than adding a specialized integration. Evaluate plugin correctness separately from caller behavior and user outcomes. A gap may require a prompt change, more caller context, a host capability or a data operation; do not assume a new backend decision engine.

The concept boundary records the user's direction on 2026-10-03 in the [boundary decision record](../note/note-20261003-llm-delegated-task-management-and-plugin.md). Positioning, audience, messaging and claim boundaries record the user's adoption on the same day in the [positioning decision record](../note/note-20261003-product-positioning-audience-and-claim-b.md). The outcome-first headline, pillars and repository description record the user's adoption on 2026-10-04 in the [messaging decision record](../note/note-20261004-outcome-first-messaging.md). The [2026-10-03 rename change](../changes/change-20261003-product-rename-generic-identifiers/change.md) records an earlier product-name change; the current product name is Weave. None of these records authorizes deployment or autonomous external actions.
