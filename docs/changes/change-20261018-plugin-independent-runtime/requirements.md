---
change: change-20261018-plugin-independent-runtime
role: requirements
---

# Requirements

- FR-001: The supported service and development paths shall use Node/PostgreSQL and the static SPA without Sites runtime selection, identity-header compatibility or D1 fallback.
- FR-002: The D1 implementation shall remain an isolated storage adapter with meaningful adapter contracts, without a production binding or Sites authentication dependency.
- FR-003: The SPA and local MCP resource shall use the same generated UI HTML, and the plugin shall distribute the resource and its runnable local server.
- FR-004: When a local UI invokes a business tool, its serving MCP shall forward the exact request to the configured Remote MCP using a user's approved public-client OAuth credentials.
- FR-005: If authorization is absent, revoked or unavailable, the local consumer shall fail closed without database access, resource-client secrets, shared-cookie fallback or public identity headers.
- FR-006: The plugin shall provide explicit connect/status/disconnect actions, a state-bound PKCE loopback callback, private token storage and serialized refresh. No authorization token shall appear in HTML, tool output or logs.
- FR-007: If a remote mutation outcome is uncertain, the consumer shall preserve its exact arguments and operation ID and shall not retry it automatically.
- FR-INV-001: Revision competition, atomic persistence, user isolation, replay, Undo and unsaved-proposal recovery shall remain owned by the existing service and shared UI.
- FR-008: Source documentation and comments shall be English, and actual domains/credentials shall remain outside tracked source and generic distribution templates.

A local resource with unsupported cross-server host routing does not satisfy FR-003/004. A package that depends on the source checkout, installed development dependencies or unbundled imports does not establish distribution. Local simulations do not establish a particular installed host's UI acceptance.
