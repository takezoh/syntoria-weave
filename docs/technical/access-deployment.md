# Access owner authentication

Access mode replaces online Gate verification. The enabled application user stays
bound to its existing issuer/subject pair; these values are durable admission
coordinates, not an endpoint to contact. Do not reassign or recreate the user when
changing identity providers.

## Configuration and request boundaries

Set `ACCESS_ISSUER`, distinct `ACCESS_MCP_AUDIENCE` and
`ACCESS_BROWSER_AUDIENCE`, `ACCESS_OWNER_EMAIL`, `OWNER_BINDING_ISSUER`,
`OWNER_BINDING_SUBJECT` and an explicit `BACKEND_HOSTS` list. Existing database,
webhook task identity, key-ring and user-scope configuration remains required.
Access mode does not need Gate resource credentials or browser registrations.
Both Gateway and backend validate the signed `Cf-Access-Jwt-Assertion`. The
backend checks the correct route audience and configured owner, and rechecks
owner admission inside each transaction. An original Google task token arrives
in `X-Forwarded-Authorization`; the backend's `Authorization` is Gateway IAM.

A dedicated browser Access application protects the entire SPA hostname. Serve
its static assets and `/api/*` on that same host with a fixed-Gateway Worker.
Configure its asset binding and run Worker code first for `/api/*`. API forwarding
must preserve the signed assertion, remove caller-supplied forwarding identity,
and avoid forwarding service-token secrets. A static-assets-only deployment is
insufficient for this mode. Use distinct MCP and browser applications/audiences.

Private renderer settings use `authProvider: "access"` and an `access` object
with `issuer`, `mcpAudience`, `browserAudience`, `ownerEmail`, `ownerIssuer`,
`ownerSubject`, `backendHosts` and `gatewayInvokerEmail`. Keep actual values in
ignored operator configuration. The public SPA configuration contains only its
same-origin `apiOrigin`, `authProvider` and optional display name. Reauthentication
opens the protected `/auth-return.html` separately and retains the mounted
workspace and its current proposals. Logout uses Access's logout endpoint.

## Shared AI and retained history

The browser principal is a person; MCP principals are one shared AI actor.
New delegation uses `any_ai`, and the UI labels AI changes as AI. Existing
receipts, audit history, names and provenance remain historical data and never
become new authorization grants. All shared AI callback subscriptions receive a
change hint, including when another member of that same group wrote the change.
Existing connection-bound callbacks are not silently adopted: clients subscribe
again under the new shared actor.

Migration `0015_shared_ai_actor.sql` and its checksummed JavaScript companion
change only current collaboration heads. They preserve ownership, IDs, revisions,
run IDs and all other fields, including arbitrary UTF-16 strings. Immutable
history and receipts stay byte-for-byte. Fence writes, finish an administrative
backup, apply the migration transactionally, verify the unchanged tables and
expected head changes, and rotate `CURSOR_EPOCH` before enabling the new API.
A pre-migration application expects the old journal; rollback must restore both
the matching data/journal and application configuration under a write fence.
Never run the old image against a new journal as an assumed rollback.

Synchronize the existing export role's SELECT grants when migrations add tables
before running the backup job. Keep runtime roles unable to export all users.
Retain backup manifests, pre/post comparisons and release identities privately.

## Local stdio MCP

Render the local consumer with explicit Access mode:

```sh
node scripts/render-local-mcp-config.mjs \
  --issuer https://identity.example.com \
  --resource-endpoint https://api.example.com/mcp \
  --data-directory /absolute/private/weave-client \
  --auth-provider access
```

Access uses OAuth authorization-server metadata and the Cloudflare protected
resource metadata path, not OIDC discovery. The local client pins the configured
issuer and resource, uses public DCR and PKCE, and does not request an OIDC ID
token. Its persisted credential binding includes the authorization profile.
Changing issuer/profile does not reuse old credentials. Legacy OIDC is an
explicit separate configuration, retained for legacy deployments.

## Hosted acceptance

Grant each private Cloud Run backend only its Gateway invoker service account and
enable the IAM check. Remove broad project invocation permissions separately.
The Gateway may be called directly with a valid JWT; WAF traversal is not required.
Locally checked JWTs remain valid until expiry even after an edge session is
revoked. Verify browser login/read/write, real MCP clients, callback delivery and
direct-Run rejection. Local checks establish none of those hosted observations.
