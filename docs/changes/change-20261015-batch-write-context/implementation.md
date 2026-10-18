---
change: change-20261015-batch-write-context
role: implementation
---

# Implementation

Introduce required private `readOperationState(operationId)` on the owner-bound store. The D1 adapter batches the existing receipt SELECT and seven complete snapshot SELECTs. It returns the receipt with a synchronous snapshot decoder backed only by the acquired rows. Deferring decoding preserves canonical mismatch precedence; invoking the decoder performs no database access.

The write application compares receipt input first, then decodes and validates the acquired graph. Matching replay serializes the current acquired graph with the original receipt. A new write uses the graph as its before-state and preserves the existing commit and post-commit read. Read-only tools and Undo target/marker reads retain their existing paths.

Update all test stores and owner composition adapters coherently; do not add runtime compatibility fallbacks. Keep SQL, ownership and effects in the adapter and replay/validation decisions in the application.

The independent design Loop succeeded with profile `design`, Loop `3d90b23aead936a5d7e3bc3b2082c36e7b6b653fe1f1d831629a9f06b03a2bdb`, ledger head `ce914c0c0d4a16b9e371fe6992bba2634e136aed68eb56b014625c610c022e1c`. This is design evidence only.
