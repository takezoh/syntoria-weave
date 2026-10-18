---
change: change-20261018-gate-authentication
role: implementation
---

# Implementation

The Node authentication composition uses the bundled Gate SDK verifier and public OIDC authorization-code/PKCE client. Bearer and Web requests share online introspection and explicit PostgreSQL subject/client admission. Web credentials are encrypted with AES-256-GCM, stored with the connection ID, and refreshed while holding the session row lock. Mutation revalidation repeats introspection after the business user lock. Additive migration 0003 leaves previously applied SQL files and business/identity values unchanged; existing sessions without Gate credentials must authenticate again.

The canonical resource is the deployment PUBLIC_ORIGIN plus `/mcp`. The Web client is `weave-web`; the resource introspection client is `weave-api`. Configuration requires version-pinned resource-client credentials and the exact allowed calling-client list. Terraform and operating documentation use this contract.
