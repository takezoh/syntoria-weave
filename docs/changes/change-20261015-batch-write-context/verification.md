---
change: change-20261015-batch-write-context
role: verification
---

# Verification

## Baseline and selected boundaries

Before source changes, source HEAD was `6e15ded87ec315cf95104125af541badf72ac048`, with only two unrelated untracked user images. A synthetic owner and Action through the production adapter on the existing SQLite D1-interface helper observed:

| Scenario | Batch calls | Standalone receipt calls | Sequential calls |
| --- | ---: | ---: | ---: |
| New write | 3 | 1 | 4 |
| Identical replay | 1 | 1 | 2 |

The helper executes production SQL but does not establish Worker or hosted D1 behavior. No action text, credentials or owner identity is recorded here.

Application tests will establish mismatch precedence and allocation/commit behavior. Adapter tests will establish production SQL call counts, acquired-state consistency, owner separation, CAS, rollback, latest-state replay, lost-response recovery and Undo. Run `pnpm check` and `pnpm build`.

MCP-to-D1 verification must use the existing built Worker and Wrangler local D1 binding (`pnpm start`, `scripts/testing/verify-worker-d1.mjs`), with synthetic owners. Record exact failures if that path is unavailable. SQLite cannot replace this boundary. Hosted D1, actual ChatGPT Work and Japanese-browser latency remain separate, unverified boundaries.

## Results (2026-10-15)

The unchanged baseline counter was run again on the candidate: an ordinary write used three batches and no standalone receipt call; identical replay used one batch and no standalone receipt call. SQL statement counts were not reduced: receipt and graph acquisition now share one batch.

- `pnpm test:application`: 24 passed; `pnpm test:storage`: 140 passed.
- `pnpm check`: lint and typecheck passed, all 528 tests passed, with zero failures, cancellations, skips or TODOs.
- `pnpm build`: passed, including the Worker and standalone local artifact.
- `pnpm db:migrate:local`: applied only the existing pending migration `0017_vengeful_blonde_phantom.sql` to local Wrangler D1. No hosted migration, new migration or remote reset occurred.
- Existing `scripts/testing/verify-worker-d1.mjs 37099`: all 11 scenarios passed against the built user Worker directly, using `env.DB` and Wrangler local D1. They covered authentication/HTTP boundaries, replay and mismatched input, CAS competition, deliberately discarded responses, conflict-aware Undo, budget rejection, mid-batch rollback, owner isolation, movement, change-feed reconstruction and retention. This was not the SQLite helper or a mock-host bridge.
- The initial `pnpm start` proxy path on port 8787 became ready but returned HTTP 503 during the private-method authentication checks where HTTP 401 was expected. Its failed observation is separate from direct-listener success; the proxy failure's root cause is unproven.
- The temporary lifecycle harness owned `pnpm start`, discovered only its own workerd user listener, ran the existing contract harness, stopped its process group and confirmed unchanged source/artifact identities. No listener remained on 8787. Shutdown by SIGINT was cleanup, not an application test result.

Source base: `6e15ded87ec315cf95104125af541badf72ac048`. The tested dirty source is identified by `sourceIdentity().worktreeSha256 = 9e5fd2cd8582d2dd078867a6354ce0920d8c49159fc9bdf22780c8fc205530e2`; the base commit alone does not identify the candidate. Built Worker `dist/server/index.js` SHA256: `9b804f526e1c2d44e7d96d4842a799d474bd6016489786ce3d4ae6680492037b`. The direct Worker contract run lasted from `2026-10-15T02:50:07.666Z` to `2026-10-15T02:50:23.109Z`; this interval is harness duration, not per-operation latency. Binding `DB` used local placeholder database ID `00000000-0000-4000-8000-000000000000`. No action text or credentials are included in this record.

Independent implementation Loop: profile `implementation`, Loop `48eaca0261f7897c33b3875fc30ece44e752fd2989328d884c70b0d765a28e22`, status `SUCCEEDED`, ledger head `2c86bcca8d27b8520704bc7963a29fa5f9b54c959e35b11d6e565b3dc6404e14`. The review found no blocking findings.

The scope query included all seven changed implementation/test files and the package. Its only out-of-scope findings were the two user PNGs already untracked before this work; they were not edited or added to the implementation scope. The query therefore does not report a globally clean checkout.

Hosted D1/Sites, trusted production header injection, actual ChatGPT Work, Japanese-browser p50/p95 and production speedup remain unverified. The change reduces one sequential storage acquisition; it does not establish D1 as the dominant cause of perceived delay. UI previews, complete response size, incremental UI adoption and deployment remain separate work under Issue #31.

## Documentation checks

Regular `docs lint` passed, including schema, content and local references; `git diff --check` passed. Additional `docs lint --conformance` did not complete: installed tooling raised `AttributeError: 'str' object has no attribute 'get'` at `runtime/document_graph/change_lifecycle.py:402` while iterating existing `boundaries.forbidden` strings. The repository schema allows these strings and the relevant existing design files were unchanged. This is tracked separately in [the local tooling issue](../../issue/issue-20261015-conformance-string-boundaries.md); no conformance success or change closure is claimed.

## Representative local latency measurements

A follow-up measurement on 2026-10-15 tested the user's hypothesis that realistic local workload performance can narrow the investigation. These are API/Worker/D1 measurements, not browser or ChatGPT interaction timings. [Raw samples and summaries](evidence/local-access-benchmark.json) and [source/artifact identity audit](evidence/local-access-identity.json) are retained without user data.

### Environment and comparison

- Built both variants in isolated temporary checkouts using the existing `pnpm build` wrappers, Node 24.16.0, pnpm 11.25.0 and the same installed dependencies. Baseline is the archived source at `6e15ded87ec315cf95104125af541badf72ac048`; the treatment runtime differs only in `lib/application/ports.ts`, `lib/application/action-service.ts` and `lib/adapters/d1-action-store.ts`. All 155 runtime source files in the measured treatment match the current worktree.
- Applied existing migrations to an empty temporary Wrangler local D1 database, generated deterministic synthetic records, then copied the closed seed state to the treatment checkout before the original runs. The main session observed the copy command succeed; no pre-run physical SQLite file hashes were captured. The varied-Notes owner was later seeded into both databases from identical generated SQL. Fixture-generation hashes, counts, Notes lengths, collections and returned revisions were checked. This is a reproducible declared seed procedure, not proof of byte-identical physical database files throughout the experiment.
- Started each build with `pnpm start` and used its own direct user Worker listener with the actual Wrangler D1 binding `DB`. No memory store, hand-written SQLite adapter or synthetic host bridge replaced that boundary. The known development proxy was used only for readiness. Each server process group was stopped after its run.
- Ran before/after/after/before for each fixture suite, with three warmups and 30 measured samples per scenario per run: 60 samples per variant/scenario, 4,320 measured scenario samples in total. The process restarts between runs; there is no database reset between the two rounds of a variant, and later rounds include the retained operation history from earlier writes. No independent-client concurrency was measured.
- Measured from client `performance.now()` before HTTP dispatch through full body receipt, UTF-8 decoding and JSON parsing. TTFB includes local transport, Worker work, D1 await, projection and serialization; it is not SQL execution time. Preview/apply totals sum the two measured RPC durations, excluding benchmark instrumentation, UI debounce, host bridge and rendering. The first per-fixture read is retained separately; it is not a cold deployment or cold D1 measurement.
- Both APIs negotiated gzip. Node fetch automatically decompressed the body: `response_bytes` in the timing samples are decompressed UTF-8 body bytes. An additional Node `http` probe, which does not automatically decompress, measured compressed HTTP body bytes separately. TCP/TLS/header/framing costs are not included in those size values.

### Datasets

Each owner has eight Projects, twelve Tags, three saved Perspectives, two Tag associations per Action, containment depth up to three, mixed lifecycle states, Due and future Defer. Descriptions and classification hierarchies are included. Titles and Notes are synthetic; no actual user content was read or copied.

| Fixture | Actions | Notes characters | Notes shape |
| --- | ---: | ---: | --- |
| `varied69` | 69 | 64,000 | Mixed empty/512/2,048/4,096-character Notes with per-item text and unique reference tokens |
| `personal69` | 69 | 70,656 | Uniform 1,024-character repeated-pattern Notes; a volume control, not a claim about real text entropy |
| `large1000` | 1,000 | 230,400 | Mixed empty/128/1,024-character repeated-pattern Notes |
| `notes100` | 100 | 819,200 | 8,192-character repeated-pattern Notes per item; long-text stress case |

The varied 69-item structured snapshot is about 147,810 characters, comparable in order of magnitude to the Issue's reported 135,369 characters. This does not establish that the synthetic owners match the user's exact data distribution, device or workflow. Repeated Notes compress especially well, so their wire-size results must not be generalized to arbitrary user text.

### Current-code latency

Milliseconds; pooled nearest-rank p50 / p95 over 60 samples per cell. All measurements succeeded, and no raw samples were discarded.

| Fixture | MCP full list | Web HTTP full list | MCP direct apply | MCP preview + apply | MCP unchanged change feed |
| --- | ---: | ---: | ---: | ---: | ---: |
| `varied69` | 14.27 / 41.91 | 10.44 / 19.28 | 18.00 / 32.92 | 23.87 / 26.82 | 2.28 / 4.42 |
| `personal69` | 14.06 / 18.25 | 9.58 / 11.31 | 18.37 / 22.26 | 26.35 / 32.90 | 2.71 / 3.78 |
| `large1000` | 134.07 / 144.79 | 108.34 / 119.19 | 217.09 / 239.21 | 399.41 / 443.03 | 2.22 / 3.52 |
| `notes100` | 46.02 / 60.64 | 31.17 / 39.93 | 63.03 / 73.15 | 84.08 / 96.40 | 2.33 / 3.08 |

### Actual effect of receipt/snapshot batching

| Fixture | Direct apply before p50 / p95 | Direct apply after p50 / p95 | Median difference (after minus before) |
| --- | ---: | ---: | ---: |
| `varied69` | 17.63 / 20.54 | 18.00 / 32.92 | 0.37 ms |
| `personal69` | 19.08 / 21.10 | 18.37 / 22.26 | -0.71 ms |
| `large1000` | 222.93 / 246.88 | 217.09 / 239.21 | -5.84 ms |
| `notes100` | 62.11 / 72.96 | 63.03 / 73.15 | 0.92 ms |

The logical one-call reduction is established, but these timings do not demonstrate a stable material local speedup. The varied 69-item direct save did not become faster in the pooled results; its after-round-1 list p50 was 28.64 ms versus 12.61 ms in after-round-2, even though the read path was unchanged. The two varied-Notes save medians were 18.40 and 17.25 ms after versus 17.58 and 17.63 ms before. The 1,000-item pooled direct-save reduction was 5.84 ms, while the after round medians differed by roughly 20 ms. All samples and per-round quantiles are retained; no significance or hosted benefit is claimed.

### Response size and remaining opportunities

For the varied 69-item full list, the Node HTTP probe observed approximately 45,561 compressed body bytes for MCP and 22,309 for the plain Web API. The decoded bodies were approximately 315,361 and 153,062 bytes respectively. For 1,000 items, corresponding compressed bodies were approximately 81,500 and 39,705 bytes. The MCP text/structured duplicate therefore has a measured body-size cost in this environment; removing it still requires preserving the public caller contract.

The existing unchanged change feed took roughly 2–3 ms and returned a 552-byte decoded MCP body, compared with approximately 14 ms / 315 KB for the varied 69-item full snapshot and 134 ms / 2.88 MB for 1,000 items. This demonstrates an available lightweight read path, not completed UI feed adoption. A consumer must reconstruct state, handle expiry, deletion, retention and resynchronization correctly.

At 1,000 items, preview plus apply remains around 399 ms median locally. Full snapshot handling, filtering/projection and repeated validation/acquisition remain meaningful non-geographic improvement candidates. TTFB is inclusive: this experiment cannot assign their individual costs or prove that SQL itself is dominant. Detail display currently consumes the already-loaded snapshot; browser inspector rendering and the UI's 500 ms editing debounce were not timed here.

### Conclusion and limitations

The current implementation with the tested 69-item synthetic owners does not reproduce multi-second API latency on local Worker/D1. This supports shifting the next investigation toward the actual hosted path and checking deployed-source correspondence, rather than assuming the SQL/application workload inherently takes seconds. It does not prove Sites or distance is the cause: hosted D1 behavior, Worker resources, authentication, connector/tool scheduling, network paths, actual browser rendering and the deployment's source may differ.

Independent investigation and verification succeeded under profile `investigate`, Loop `0eba8badc88f396f1dbcb2ec24ba9f3638a3769d3616894404f2351bc05813f9`, ledger head `0ae94b88f2b3dfc7d69bd2c7e9106b29519fd64c05940d34fccb963a1ed43f83`. Independent review found a temporary lifecycle-helper reporting defect: its inherited `sourceUnchanged` expression compared absent `worktreeSha256` properties, while the custom manifest uses `sourceSha256`. That boolean was not used as proof. The saved complete pre/post manifests and real `sourceSha256` fields were directly compared for all eight runs and matched, as did artifact hashes; the separate identity audit records those checks. This did not alter measured timings or remove any samples.

No application source, deployment, hosted database or geographic configuration was changed by this follow-up. The main worktree's existing local data was not used; the benchmark used isolated temporary databases. This supplements the earlier call-count result with actual bounded local latency evidence.
