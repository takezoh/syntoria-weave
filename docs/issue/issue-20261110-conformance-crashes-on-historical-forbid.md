---
id: issue-20261110-conformance-crashes-on-historical-forbid
kind: issue
title: Conformance crashes on historical forbidden boundary strings
status: open
created: '2026-11-10'
issue_type: bug
tags: []
owners: []
relations:
- {type: originatedFrom, target: change-20261110-access-owner-authentication}
subject_paths:
- docs/design
---

# Symptoms

`docs lint --conformance` crashes rather than reporting a verdict for existing
string entries under `boundaries.forbidden` in design documents. Structural lint
passes. This is independent of Access runtime behavior.

# Evidence

The conformance reader raises `AttributeError: str object has no attribute get`
while constructing forbidden targets. Existing entries in `docs/design/product.md`,
`docs/design/design-ui-visual-policy.md` and `docs/design/assistance.md` are prose
strings. No historical design frontmatter was changed by this migration.

# Context

The active Access migration records the missing conformance verdict explicitly.
Reconcile the document schema and validator in a separate documentation/tooling
change; do not rewrite completed change records to conceal the failure.
