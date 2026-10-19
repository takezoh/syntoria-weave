---
change: change-20261019-dcr-only-mcp
role: implementation
---

# DCR-only implementation

Gate owns provider registration, validation, Firestore client persistence and globally bounded admission. Its maintained OAuth provider owns protocol behavior. Confidential resource introspection clients and browser application registrations remain explicit settings.

The Gate SDK and bundled Weave verifier accept dynamic OAuth caller IDs while preserving consistent identity, approval, audience, expiry and online revocation. Browser verification separately checks the configured browser client ID. PostgreSQL admission resolves only an explicitly enabled issuer/subject to the stable internal user. Client IDs remain credential correlation data; applied SQL migration identifiers are preserved.

The standalone MCP consumer discovers DCR, registers its native loopback redirect, persists registration separately from credentials and retains process/generation protection. ChatGPT uses its host-managed DCR connection. Renderers and install procedures contain no fixed public OAuth client ID. The host-issued app dependency and private marketplace remain separate.

Implementation units are Gate provider/storage/SDK, Weave authentication/admission/configuration, and local consumer/plugin installation. The shared HTTPS Gate + real PostgreSQL HTTP/MCP harness verifies integration after those units are composed. No production deployment is included in this change.

## Release impact

Migration 0004 removes the client-grant authorization table and preserves the subject-to-user mapping and business state. Administrative subject mapping uses `map-subject`; the transfer format is version 3 and accepts no version-2 fallback. Connection revocation belongs to Gate; local subject disabling remains application admission. Fixed public-client registrations and their connection setup are not carried forward. Clients must obtain a DCR registration and approve their connection.

Deployment requires a write fence, a reviewed backup and coordinated Gate/API configuration and schema rollout. A previous API image cannot run against the subject-only schema; reverting this contract requires an explicit database/auth configuration recovery, not an image-only rollback. Hosted rollout and client reauthorization are not part of the local implementation evidence.
