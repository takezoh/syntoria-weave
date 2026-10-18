# Connect Syntoria Weave to ChatGPT

Syntoria Weave is an independent shared-state service with HTTP API, Remote MCP and a Web UI. ChatGPT plugin support is one optional integration. Installing a ChatGPT plugin does not provision the backend.

1. Obtain the authorized deployment's HTTPS MCP endpoint and authentication details. If no backend exists, complete backend deployment first.
2. Register or reuse the connection through ChatGPT's supported external MCP/plugin installation flow. Use actual host-provided identities; do not invent installation metadata.
3. Authenticate and grant the intended access. Keep connection credentials outside shared source.
4. Retrieve current tools in a supported fresh host session. Read the action-tools contract, call list_actions and open_actions, and inspect the UI.
5. Record authenticated reads and observed UI behavior separately. Installation is incomplete for any required capability that the host does not support or that has not been verified.

Backend deployment, connection registration, authentication and UI acceptance are separate outcomes. The installation method must be verified against the actual host. This document does not assert that a particular external registration flow has passed acceptance.
