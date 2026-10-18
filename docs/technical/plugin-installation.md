# ChatGPT plugin installation

ChatGPT is one optional client of the independently deployed Weave service. Backend infrastructure and Web access do not require plugin installation. Deploy and verify the service first using [deployment](deployment.md).

## Connection contract

Use the actual deployed HTTPS Remote MCP endpoint and its OAuth protected resource metadata. The service validates access tokens and derives users from verified identity. Register the service using the host's supported external MCP/plugin connection flow. Verify that flow and available capabilities against the current host; do not invent plugin IDs, connection formats or authentication support.

Reuse the user's existing matching registration when updating. Keep account-specific connection IDs and credentials outside shared source. Restrict access to the authorized audience. Browser sign-in or consent may require user participation; record the concrete host boundary.

## Acceptance

Authenticate the connection, retrieve current tools and resources, and check authenticated list_actions plus rejected unauthorized access. Open the shared UI through open_actions and inspect rendering, tool communication and draft preservation. A successful MCP call does not prove UI support. Record backend revision, endpoint, host registration identity, authenticated account and observed results without secrets. Missing host capabilities remain explicit installation limitations, not reasons to change the backend contract.
