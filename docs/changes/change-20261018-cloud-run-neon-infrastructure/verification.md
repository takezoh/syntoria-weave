---
change: change-20261018-cloud-run-neon-infrastructure
role: verification
---

# Design verification and implementation acceptance

## Evidence established in this documentation task

The main session inspected actual OwnerActionStore and OwnerCommitRequest types, application replay/commit ordering, row/schema definitions, cursor scope/codec and protocol definitions. This establishes preservation obligations, not evidence that Node/PostgreSQL is implemented. Main-session review and document lint/link/content checks are the only validation performed here; record exact command outcomes when finishing the task.

The user authorized direct design after the mandatory skill execution route failed at attach with loop-registration-conflict before provider requests. No skill success or independent reviewer verdict is claimed.

## Source-to-contract findings

| Source observation | Design consequence |
| --- | --- |
| Application compares canonical receipt before lazy graph validation and ID allocation | Preserve readOperationState capture and synchronous lazy decoder; commit also rereads receipt before revision CAS. |
| Application reads current state after commit | Do not return prepared after-state; later corrections must survive replay/current response. |
| Port separates prepare/read and commit | Use repeatable-read read acquisition plus read-committed lock/CAS commit; no application-wide transaction holding a connection. |
| Revision is MAX retained operation revision; reads create no owner row | Use owner advisory transaction locks for empty and populated owners, preserving row-free reads. |
| Domain accepts case-sensitive strings matching a case-insensitive UUID pattern | Store IDs as C-collated TEXT, not normalizing uuid types. |
| Notes/descriptions allow arbitrary strings within UTF-16 length bounds | Encode free-text cells as canonical JSON strings; preserve NUL/lone surrogates. |
| Operations and perspectives are serialized JSON text | Preserve exact JSON text; avoid jsonb canonicalization and its Unicode restrictions. |
| Catalog marker kind is project/tag/action_tag/perspective | Keep that exact discriminator; do not invent action markers. |
| Cursor has a 43-character scope plus revision/fence | Keep cursor shape, derive scope from stable owner plus deployment epoch to force resync after timeline changes. |
| Same identity capability is used by HTTP and MCP | Replace verification/composition effects once, never fork owner/domain logic by client. |

## Self-review counterexamples resolved

- A write waiting under repeatable-read could pin a stale snapshot. Commit is read-committed and queries receipt/revision in a later statement after obtaining the owner lock.
- An empty owner's concurrent first writes cannot lock a missing row. The advisory transaction lock exists independently of rows.
- Revision conflict could hide a duplicate successful operation. Receipt comparison precedes revision validation in commit.
- JSONB/native UUID/timestamp driver conversions could alter preserved input. The storage mapping is explicit and tested for edge values.
- A max-instance setting alone cannot strictly cap connections. Database role caps and bounded acquisition are final controls, with reserved administrative capacity.
- Restored DB revisions can look valid to existing cursors and restored grants can re-enable access. Rotate external CURSOR_EPOCH and reconcile authorization before opening traffic.
- Terraform provider outputs can disclose generated secrets. Bootstrap secret values outside shared Terraform state/artifacts and pin Secret Manager versions.

## Runtime acceptance matrix (not executed)

| Boundary | Required tests | Evidence needed |
| --- | --- | --- |
| Pure logic / DTOs | C1–C4, lifecycle/order/flags, perspectives, original text, codecs, safe integer limits, input nonmutation | Actual suite output tied to source |
| PostgreSQL | concurrent empty/ordinary writes, same/different replay, mid-transaction and deferred-FK failure, lost COMMIT response, fresh corrections, Undo/ABA, retention, feed fencing, RLS | Real PostgreSQL 17 and deployed Neon reports; fakes cannot close this row |
| Node transport | stateless MCP initialize/tools/resources/notifications, protocol headers, HTTP errors, mixed credentials, request/body/timeout limits, SIGTERM recovery | Built Node entry exercised against actual adapter |
| Identity | issuer/audience/algorithm/expiry/scope checks, client/subject grants, PKCE/state/nonce replay, CSRF, session expiry, logout, account switch, revoked grant | Fixtures plus staging Auth0 interaction, separately reported |
| IaC/delivery | WIF restrictions, secret redaction, role separation, connection budget, schema compatibility, immutable artifact and revision | Validated plans and actual environment release record |
| Migration/restore | exact decoded equality, owner mapping, receipts/history, write fence, epoch reset, no lost pending proposals, revoked restored sessions/grants | Isolated rehearsal and before/after audit manifest without content |
| UI | retained proposals, unknown operation, stale revision, account change, focus/caret/IME and actual host communication | Browser and actual required client results, separately reported |
| Performance/operations | representative 69/1,000/large-notes fixtures; warm/cold/API/DB/client spans, pool saturation, backup age and restore | Raw samples, deployment identities and measured p50/p95; no claim from local-only results |

No runtime unit in this matrix has been executed by this documentation task. A later implementation must run pnpm check and pnpm build plus boundary-specific real-adapter and deployment checks.

## Executed documentation checks

- dev-docs lint: PASS, 77 indexed documents, zero warnings.
- Local document verifier: PASS across 13 design/package documents and 63 local links/heading anchors; all code fences and whitespace checks passed.
- Requirement/plan checks: 14 FRs, one invariant FR, 8 NFRs and 7 implementation units present; no template placeholders.
- Configuration arithmetic: 30 planned revision connections +10 runtime surge +2 job +22 reserve =64 minimum database capacity, consistent with the requirements.
- JavaScript-only codec feasibility: six samples including NUL/lone surrogates/Japanese/backslashes/emoji/mixed-case IDs round-trip through JSON string encoding. This does not test PostgreSQL and is not adapter acceptance.

No app suites, resource provisioning, deployment, managed-provider login or independent review were performed.
