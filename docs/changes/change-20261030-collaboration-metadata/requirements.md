---
change: change-20261030-collaboration-metadata
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

On 2026-10-30 the owner asked that AI collaboration data follow the Action Notes/Metadata split: text for the person rendered as Markdown, and caller-managed metadata kept separately. The record-level field mirrors Action `metadata`; separate proposal and report metadata was considered and not adopted because a person's proposal edit, an AI revision and a run report would then each need their own preservation rule for one caller's operational notes.

- FR-001: Each collaboration record shall carry `metadata`, exact text of at most 65,536 UTF-16 code units, defaulting to empty.
- FR-002: `propose_collaboration` (`metadata`) and every `update_collaboration` command including `adopt` (`payload.metadata`) shall accept it from any authenticated actor. Omission shall keep the saved value; an empty string shall clear it.
- FR-003: Metadata shall never change the decision, progress, version or any other field that a command records.
- FR-004: Reads, `get_collaboration` history, receipts and logical transfer shall carry it exactly; identical replay shall return the receipt and a different value under the same operation ID shall be `idempotency_conflict`.
- FR-005: Migration `0012_collaboration_metadata.sql` shall state empty metadata for existing heads and history without rewriting stored text; stored records without the member shall fail validation, and transfer version 10 shall require it while rejecting version 9.
- FR-006: The UI and the copied request for AI shall never contain metadata. Tool schemas shall describe the proposal fields, summary and remaining as text shown to the person and rendered as Markdown.
- FR-INV-001: Records and metadata stay user-scoped; another user's reads see neither.

Counterexamples: a person's decision dropping the AI's metadata; metadata changing approval; a retry with edited metadata under the original ID being applied; a legacy body accepted without the member; metadata appearing in a card, its text content or the handoff.
