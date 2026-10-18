---
change: change-20261018-cloud-run-neon-infrastructure
role: requirements
---

# Infrastructure requirements

## Mandate and acceptance boundary

Design the independent state service on Cloud Run and Neon PostgreSQL. HTTP API, Remote MCP and Web UI share the same application/domain. This package defines implementation contracts and verification, not application implementation, resource creation, deployment or installation prompts. The user authorized main-session design directly; independent review has not been performed.

## Functional requirements (EARS)

| ID | Requirement | Owning boundary |
| --- | --- | --- |
| FR-001 | The service SHALL expose the established action operations through authenticated HTTP and stateless MCP using one application/store path. | Node composition |
| FR-002 | WHEN a token/session is presented, the service SHALL verify issuer, audience/type, validity and subject/client grants before issuing an owner-bound capability. | Identity |
| FR-003 | IF credentials are invalid or missing, the service SHALL reject with 401; IF valid identity has no enabled required grant, it SHALL reject with 403 without business effects. | Identity/HTTP |
| FR-004 | WHEN the Web login callback succeeds, the service SHALL consume its state once, validate PKCE/nonce and establish an opaque expiring session; logout SHALL revoke it. | Identity/session |
| FR-005 | WHEN a read occurs, the adapter SHALL capture revision, state and feed retention fences from one database snapshot without creating records. | PostgreSQL |
| FR-006 | WHEN a mutation commits, the adapter SHALL serialize same-owner writers including first writes, validate the latest revision and atomically commit changed rows, identity markers, receipt, delta and pruning. | PostgreSQL |
| FR-007 | IF an operation receipt exists, canonical mismatch SHALL fail before graph validation/ID allocation; identical replay SHALL return the original result and current state without reapplying. | Application/adapter |
| FR-008 | IF commit/response outcome is uncertain, callers SHALL retain exact operation IDs/arguments and use lookup or identical replay; UI proposals SHALL survive. | Transport/UI |
| FR-009 | WHEN Undo is requested, later target corrections and identity/reference changes SHALL reject conflicting Undo while preserving unrelated changes. | Domain/adapter |
| FR-010 | WHEN change pages are read, the service SHALL return committed owner revisions in order with whole-operation pagination, retention expiry and stable continuation fencing. | Feed |
| FR-011 | WHEN cutover or timeline restore rotates CURSOR_EPOCH, prior scopes SHALL return invalid_cursor; ordinary releases SHALL preserve the epoch. | Composition/feed |
| FR-012 | WHEN data is imported, IDs, text/code units, timestamps, revisions, receipts, deltas, association and identity records SHALL remain equivalent after decoding. | Migration |
| FR-013 | WHEN a release occurs, it SHALL associate source, image digest, migration journal, configuration and Cloud Run revision with acceptance evidence. | Delivery |
| FR-014 | WHEN a backup is restored, access SHALL remain closed until authorization revocations, identity state, schema/data invariants and cursor resync are reconciled. | Operations |
| FR-INV-001 | The service SHALL preserve C1–C4, original input, containment/order/flags, perspective variants, owner authorization, revision/replay/Undo and dirty-proposal recovery across every transport and infrastructure change. | All boundaries |

## Nonfunctional requirements

| ID | Requirement / acceptance |
| --- | --- |
| NFR-001 | Pure domain/data/UI decisions remain deterministic and nonmutating; concrete runtime imports stay behind adapters and are linted. |
| NFR-002 | API uses bounded pools (5/instance), configured request/SQL/lock deadlines, role connection cap 40 and verified total DB capacity >=64. Exhaustion returns bounded retryable failure, not unbounded queuing. |
| NFR-003 | Production deploys to Cloud Run asia-southeast1 and Neon aws-ap-southeast-1; min API instances=1 and DB autosuspend off. Recurring cost and environment-specific identifiers are explicit deployment inputs. |
| NFR-004 | Engineering objectives: warm p95 <=300 ms for representative 69 actions and <=1 s for 1,000; cold p95 objective <=3 s. Measure API/DB/client separately; these are not achieved results. |
| NFR-005 | API secrets are version-pinned in Secret Manager, never Terraform outputs/state or logs. CI uses environment/ref-restricted OIDC WIF; runtime cannot migrate schemas or export all data. |
| NFR-006 | Production PITR window=7 days and independent encrypted logical backups retained 30 days; logical-backup RPO <=24 h, restoration RTO objective <=60 min, tested monthly. |
| NFR-007 | Logs/metrics exclude action text, request/receipt bodies, SQL values, credentials and personal identifiers. High-cardinality business IDs are not metric labels. |
| NFR-008 | Failed, skipped, canceled, TODO and unexecuted checks cannot be counted as successful acceptance. Test actual PostgreSQL, Node transport, deployed identity and Web/client UI separately. |

## Counterexamples and observable acceptance

| Scenario | Required observation | Trace |
| --- | --- | --- |
| Two initial writes both use expectedRevision=0 | One distinct operation commits revision 1; the other conflicts. Same-ID/same-input race returns one receipt/result. | FR-006/007 |
| Same receipt ID, changed payload, malformed stored graph | idempotency_conflict occurs before graph decoding error; no IDs allocated. | FR-007 |
| Reader pauses after revision query while writer commits | Reader sees one consistent before/after snapshot, never a mixed graph/revision. | FR-005 |
| Waiter enters commit while previous owner writer is uncommitted | Receipt/revision queries run after lock acquisition and see the previous commit. | FR-006 |
| A statement or deferred FK fails | No business row, receipt, revision or pruning commits. | FR-006 |
| COMMIT succeeds but connection/reply is lost | Lookup/replay returns that operation once; no fresh ID is generated. | FR-008 |
| Correction is saved before replay or post-commit refresh | Original operation result is retained and current snapshot includes correction. | FR-007/008 |
| Token has valid signature but another API audience, missing scope or disabled grant | Reject; forged owner/header arguments cannot redirect access. | FR-002/003 |
| Cookie and bearer identify different users | Reject mixed credentials; no fallback/merge. | FR-002 |
| User signs into a different account with unsaved/unknown edits | Keep proposals isolated; require explicit account reconciliation, never send them to the other owner. | FR-008 |
| Free text contains NUL, lone surrogate, quotes or Japanese | Exact JS string round trip; raw text is not normalized by PostgreSQL types. | FR-012 |
| Restored DB has earlier revisions but a client still holds an old cursor | Scope invalidation requires complete resync; no false empty feed or silent cache reuse. | FR-011/014 |
| Invalid or exhausted UI save | Proposal and exact unknown request survive; no successful save indicator until authoritative result/state. | FR-INV-001 |

## Exclusions

No new action semantics, prerequisites, scheduler, recommendation LLM, background management workflow, shared Thymesis database or automatic source collection. Backend provisioning is independent of any client installation. No legacy architecture is maintained as an alternative design.
