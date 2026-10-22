# Syntoria Weave — Product

**Keep less in your head. Your AI keeps track of the rest.** Design your own workflow with your AI—GTD, a simple daily list or something entirely new; it captures, organizes and reviews your tasks your way while you stay in control.

Syntoria Weave is Syntoria's State Store: where AI shares structured state with people and other authorized AI callers. The state it holds is what is currently true of the work—open actions, items waiting on a decision, the relations between them and the intent recorded against them—together with the original input, its background and references back to the source. Its current data model covers everyday work and personal actions, including unfinished thoughts and reference notes. Conversations, the dedicated UI and authorized caller workflows read and update the same saved state, so you can delegate upkeep while retaining a place to inspect and correct it. The intended benefit is less effort remembering, collecting, organizing and reviewing, with more attention for action, decisions and rest. Weave exposes shared-state capabilities through API/MCP and a dedicated UI. A ChatGPT plugin is one client integration; the service does not depend on a particular assistant or management method.

## Who it is for

| Audience | Why Weave fits |
| --- | --- |
| Individuals who use an AI assistant daily and want it to handle task upkeep, especially people for whom maintaining a to-do app became work in itself | No app routine has to be learned; the method lives in conversation, and safe writes reduce the need to supervise each change |
| GTD practitioners and people who run their own systems | The method stays in prompts while actions, containment, projects, tags, dates and perspectives remain stable |
| People who build their own agents or scheduled workflows | Composable API/MCP tools accept changes from any authorized caller workflow |

Weave supports personal workflows. Shared state stays within the authenticated user's boundary: multiple conversations or authorized callers work with that user's records, without exposing them to other users. Calendar planning, reminders and background execution belong to the caller's environment.

## Value and approach

| Desired benefit | Supporting behavior |
| --- | --- |
| Get it out of your head | Save the original input, including unresolved concerns and references, without requiring a deadline, classification or commitment |
| Set aside what is unnecessary now | Defer hides actions until a chosen time while preserving content and Due |
| Hold what is waiting on someone else | Explicit on-hold keeps an action unfinished and visible, editable independently of Defer |
| Design a workflow that fits you | Prompts and AI workflows choose GTD or another method over the same data tools |
| Change methods without rebuilding lists | Keep saved actions while changing prompts and caller-side routines |
| Let your AI do the upkeep | Capture, clarification, organization and review run through the AI's prompts and tools over the same saved actions |
| Continue with current context | An authorized conversation or workflow can read the current saved state, including corrections made through the UI or another conversation, before deciding what to do next |
| Stay in control without watching every change | Writes based on an outdated revision are rejected instead of overwriting newer edits; the UI retains unsaved proposals; identical retries are recognized and not applied twice; lost responses can be checked or resent exactly; Undo refuses to erase later corrections |
| See and fix anything | Conversation and UI read and update the same saved actions |
| See relevant work | Your AI presents candidates with reasons, distinct from the complete list |

Your AI handles interpretation, judgment, organization, recommendations and management policy. Weave stores, retrieves and updates structured state through API/MCP operations and a dedicated UI, with validation, revisions, atomicity, replay, Undo and ownership. Reading state gives the AI information to consider; the AI remains responsible for understanding it and revising its judgment. The API entity is named action. Containment, projects, tags, order, direct flags, dates and perspectives support GTD or another caller-chosen management method without requiring a fixed workflow.

User prompts, the user's AI and caller-side schedulers can use the same tools. An authorized agent can collect Slack/email commitments with its own external tools and save or update actions in Weave. No dedicated Weave agent integration is needed: source access, interpretation, execution timing and notifications are responsibilities of the caller. Changing the caller's workflow does not require changing Weave's data operations.

## What Weave does not promise

- Weave does not remind, notify, plan a calendar or run in the background.
- Weave has no AI of its own and does not decide what matters.
- Weave saves what the caller requests. It cannot prove that your AI interpreted you correctly; inspect and correct actions as needed.
- Undo works only within retained recent history, the latest 100 operations per user, and refuses when it would erase later corrections. Not every change can be undone.
- Confirmation steps shown by the host are outside Weave.
- Current host acceptance evidence concerns ChatGPT; other client integrations require their own verification.
- Reduced management effort is an intended benefit, not a measured result.

## Everyday usage

“Prepare for the trip: check what I have, then buy what is missing; keep the information page as a reference.” That becomes a parent action with checking ordered before buying, the reference URL kept as a reference rather than another errand, and the original sentence preserved as written. The order records the plan; a later action can still be completed first.

A concern such as “I may clear out the family house, but have not decided how much” can remain in Inbox with its original notes. Saving does not require a deadline, classification or commitment to perform it.

Defer an action when it is unnecessary now. A date-only choice resolves to that day's 09:00 in the explicit client timezone; later timezone changes do not shift the saved instant. Parent Defer affects descendants' visibility without overwriting their dates. Deadline conflicts can be shown before saving.

Arrange sibling actions by order and use direct Flags to mark attention. A Flag does not inherit and does not change lifecycle, Due or Defer. The Flag view includes marked normal-view actions; deferred or ended flags remain saved and queryable.

Save a reusable perspective through conversation when you want to repeat a particular selection. Perspectives store extraction conditions only and retain the existing action order. Select a saved perspective in the dedicated UI; create and edit its definition through the tools or API. Ask for candidates matching a purpose or context. Recommendation alone does not hide, complete, defer or drop unselected actions. Return to the full normal, deferred or historical list when needed.

## State and relationships

| Concept | Meaning |
| --- | --- |
| Action | A saved editable item, including original input and reference notes |
| Containment | One parent action; independent prerequisite edges are absent |
| Order | Intended sibling sequence, without execution or display restrictions |
| Direct Flag | Optional boolean attention mark, without inheritance |
| Project / tags | Separate classification hierarchies; an action has at most one project and multiple tags |
| Inbox | Unfinished project-unassigned actions, including deferred ones |
| Normal | Unfinished actions not hidden by own or ancestor Defer; includes explicit on-hold |
| On-hold | Explicit waiting, independently editable and distinct from Defer |
| Due | A deadline, distinct from wanting to work on a date |
| Completed | Finished work; completing a parent completes descendants atomically |
| Dropped | Withdrawn work, retained and editable rather than falsely completed |

Completing all children never automatically completes the parent. A descendant can reopen independently of a completed ancestor. When the user or an authorized caller reports evidence of an arrival, it can update the explicit waiting state without automatically completing the action or releasing Defer. Weave stores the requested change; observation and interpretation belong to the caller.

## Conversation, UI and reliability

Conversation accepts uncertainty, helps organize relationships and explains candidate choices. The dedicated UI provides the saved list, notes, dates, order and Flag controls for direct correction. Titles and notes are shown formatted with clickable links; choose Edit to change the original text. Conversations and UI use one durable state for the authenticated user.

For example, correct a trip action's title in the UI, then ask ChatGPT in another conversation to read the current action before planning the next step. That read retrieves the saved correction even if the conversation still contains the old title. An authorized AI workflow can use the same state to continue its own work. Weave preserves the shared records; each caller decides what the correction means for its recommendations or actions.

Current reads provide a full snapshot with a user-wide revision, or a requested selection of actions. The revision protects writes from stale state. A read does not record human read status, complete an action or prove that an AI has incorporated the information into its decisions.

After a conflict compare the latest saved state with the retained proposal. After a missing response preserve the original request and check its result or resend identically. Do not claim success or failure merely from response loss. Undo does not silently erase later target edits. These guarantees reduce the supervision burden of delegating organization.

## Scope and evidence

Current scope includes original-input preservation, actions, containment, order, direct flags, projects/tags, explicit on-hold, Due/Defer, lifecycle editing, replay and Undo, shared by conversation and UI. Independent prerequisite edges and sequential/parallel modes are unsupported. Planned, estimates and recurrence are not implemented data capabilities. Calendar synchronization, notifications, external-source collection and background execution are caller capabilities; callers may compose such workflows with Weave data tools, and they are not prerequisites or planned integrations for using the service.

Local tests and implementation completion do not establish hosted acceptance or long-term reductions in management effort. Hosted behavior requires verification in the actual delivery environment.

Success means fewer missed important matters and less total remembering, explanation, approval, correction and supervision work. More actions or completions alone are not success; dropping work or resting can be appropriate choices. General availability and pricing remain undecided.

[Introduction](README.md) · [Architecture](ARCHITECTURE.md) · [Development](docs/development.md)
