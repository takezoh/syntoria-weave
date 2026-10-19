# Syntoria Weave

## Keep less in your head. Your AI keeps track of the rest.

**Design your own workflow with your AI—GTD, a simple daily list or something entirely new. It captures, organizes and reviews your tasks your way, while you stay in control.**

Syntoria Weave is Syntoria's State Store: where you and your AI keep the current state of your work—what is open, what is waiting on a decision, how things relate and what you meant to do with them. You, your AI and other authorized AI workflows read and update the same saved state, across conversations and the dedicated UI.

Tell your AI “I keep meaning to deal with the storage unit, and I'm not sure it's even worth keeping.” It saves that in your words—no deadline, no category, no commitment—and brings it back when you ask what is still unsettled. You spend less energy remembering and organizing, and more on doing, deciding and resting.

## Get it out of your head

Hand over commitments, concerns and unfinished thoughts as they are. Your original words are kept, and you do not have to pick a deadline, a category or even a commitment first. Put aside what you do not need right now with Defer; the task and its deadline stay saved and return to your list at the time you choose. Something waiting on someone else's answer can sit as on-hold—still open, without pretending to be done.

## Design a workflow that fits you

Weave comes with no built-in method, so the workflow is yours to design. Follow GTD, keep a simple daily list, or invent a system of your own together with your AI. Your method lives in your prompts, not in the app. Projects, tags, order, flags, dates, smaller steps inside a task and saved views are building blocks you combine as you like. Change your approach whenever you want—your tasks stay where they are.

## Let your AI do the upkeep

Capturing, clarifying, sorting into projects, weekly reviews, choosing what to focus on next: ask your AI, and it does the work inside your system. Agents you set up can also bring in commitments from Slack or email and file them as tasks. Your attention goes to the tasks themselves, not to maintaining the list.

## Pick up where you left off—in any conversation

Rename the hotel in the dedicated UI on Monday. On Thursday, in a different conversation, ask your AI what is left for the trip: it reads the current saved state and works from the new name, not the one it saw last week. Another AI workflow you authorized reads the same state and the same correction. Each one reads when it continues, so ask yours to check the saved state if a conversation has been open for a while.

## Stay in control—without watching every change

Your conversations and the dedicated UI use the same saved tasks. Check anything and fix it directly, in either place.

Let your AI reorganize the list while you are doing something else, then look only when you want to. Your wording survives, your unsaved edit waits for you, a repeated request still means one change, and a correction you made afterwards stays made.

## Who it is for

If you have set up a to-do app three times and stopped maintaining it three times, the upkeep was the problem. If you already run GTD or a system of your own, it stays yours—the method lives in your prompts, not in the app. If you build your own agents or scheduled workflows, they write to the same state.

Weave supports personal workflows over your own saved state. Calendar planning, reminders and background workflows are arranged in your AI's environment.

## Add Syntoria Weave to ChatGPT

Ask ChatGPT Work to read [INSTALL.md](INSTALL.md) and perform the installation:

```text
Read https://github.com/takezoh/syntoria-weave/blob/main/INSTALL.md and install Syntoria Weave for me.
```

Provide the deployment's HTTPS MCP endpoint, Gate issuer and registered public client ID when requested. Register the exact OAuth callback shown by ChatGPT with Gate. After connecting, use ChatGPT to show your actions and open the list.

For other MCP clients, follow [MCP client setup](docs/technical/mcp-installation.md). The dedicated browser UI reads and updates the same saved state.

## Use cases: ask your AI

Use your own words. For example:

- “Keep this for me: I may clear out the family house, but haven't decided how much.”
- “Build a GTD routine with me: capture, clarify, organize and review. Keep my original notes.”
- “Set up a simple routine with me: each morning, show me three things to focus on.”
- “Run my weekly review. Show each project's next action and suggest what to focus on.”
- “Make my routine simpler. Keep the same saved list.”
- “Open my list so I can check and edit it.”
- “I corrected the trip plan in another conversation. Read the saved actions and help me decide what to do next.”
- “Undo the last change.”

See [use cases and example prompts](docs/usage/use-cases.md) for capturing concerns, organizing projects, building a GTD routine, reviewing progress and collecting inputs from other tools. You can adapt the prompts to your own method.

## How it works

Weave stores shared state; your AI interprets it and decides how to help. Your prompts, ChatGPT or an authorized agent you set up determine what to capture, how to organize it and when to act. Weave provides the tools to read and update actions, preserves their relationships and keeps changes consistent and easy to correct. Each reader can retrieve the current saved state before making its next decision.

Weave has no AI or background scheduler of its own; a deferred task returns to the list when it is next read after its Defer time.

## What your list contains

Each task is saved as an **action**, the name used in the dedicated UI and tools. An action holds a title, notes and its current state. Actions can contain smaller actions, belong to a project and have multiple tags. Dates, order and flags help express your intent. Saved **perspectives** let you revisit a selection of the same actions without copying them. Unclassified concerns can stay in Inbox.

See [Product and usage](PRODUCT.md) for the meaning of these building blocks.


## License

Syntoria Weave's source code is released under the [MIT License](LICENSE). Bundled third-party files keep their own licenses.

[Product and usage](PRODUCT.md) · [Architecture](ARCHITECTURE.md) · [Development and verification](docs/development.md)
