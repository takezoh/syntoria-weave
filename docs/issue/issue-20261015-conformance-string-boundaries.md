---
id: issue-20261015-conformance-string-boundaries
kind: issue
title: Conformance checker crashes on existing string forbidden boundaries
status: open
created: '2026-10-15'
issue_type: bug
tags: []
owners: []
relations:
- {type: originatedFrom, target: change-20261015-batch-write-context}
subject_paths:
- docs/design/product.md
- docs/schemas/design.schema.json
summary: The installed conformance checker crashes on existing schema-valid forbidden
  boundary strings; regular documentation lint passes.
---

## Symptom

The dev-docs conformance checker crashes on existing string entries in design forbidden boundaries. Regular schema/content/reference lint succeeds. The observed failure is in the installed tooling, not an application runtime failure.

## Evidence

Running the installed dev 0.2.0+gc09fadb482c9 docs CLI with `lint --conformance` raises `AttributeError: 'str' object has no attribute 'get'` in `runtime/document_graph/change_lifecycle.py:402`. The comprehension iterates `boundaries.forbidden` and calls `value.get("target")`. Existing `docs/design/product.md` stores strings; the repository design schema explicitly permits legacy strings or stable statement objects. These inputs were unchanged by the discovered change.

## Context for follow-up

Keep application performance work separate from tooling/schema compatibility. Determine the supported migration and checker behavior before modifying existing design declarations. Do not treat the failed command as a successful conformance check or alter valid existing product guidance solely to suppress the exception.
