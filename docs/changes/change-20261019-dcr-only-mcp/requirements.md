---
change: change-20261019-dcr-only-mcp
role: requirements
---

# DCR-only MCP requirements

- FR-001: When an MCP client connects, it shall obtain its public client identity through Gate DCR; installation shall not require a predefined OAuth client ID or manual callback registration.
- FR-002: While a client is only registered, Gate shall not grant access. Access shall require the configured GitHub identity, explicit connection approval, PKCE and a valid audience-bound token.
- FR-INV-001: Weave shall derive its internal user only from an online-verified Gate issuer/subject and an explicitly enabled local subject mapping. Caller data and client metadata shall never select a user.
- FR-003: When a connection or local subject is revoked, subsequent checks, including locked write revalidation, shall reject access.
- FR-004: The standalone consumer shall retain a bound DCR registration independently of tokens, serialize processes and preserve generation protection. Refresh shall use that registration without registering again.
- FR-005: The personal ChatGPT package shall retain the required host app dependency, empty MCP server manifest, both operation skills, shared UI and cloud operation. Its host app ID is distinct from a DCR OAuth client ID.
- NFR-001: Registration input, metadata, registration frequency and stored clients shall be bounded without trusting caller names or triggering arbitrary outbound metadata requests.

Counterexamples include a registered but unapproved client, wrong GitHub identity, invalid callback or PKCE, disabled/unmapped subject, wrong resource, revoked connection, static-client configuration and a refresh that creates another registration. Browser CORS/CSRF, proposals, replay and user isolation remain required.
