# ChatGPT integration updates

Backend releases follow [deployment](deployment.md). Optional ChatGPT registration follows [plugin installation](plugin-installation.md). Neither operation owns the other.

## Refresh the registered tools

Identify the existing connection by its deployed MCP endpoint and registration identity. Use the host-supported refresh operation, preserving credentials and access scope. Retrieve current tool schemas and UI resources in a fresh supported host session. Do not claim refresh from a backend deployment alone or replace an existing registration silently.

## Verify the update

Compare advertised tools, schemas and resources with the released source. Check authenticated reads, open_actions, actual UI rendering, host communication, retained drafts and unknown-result recovery separately. Host navigation and sidebar exposure are integration-specific capabilities, not universal service requirements.

## Report

Record source, container digest, Cloud Run revision, MCP endpoint, connection identity, tool/resource refresh and actual host behavior. Distinguish transport success, authenticated business access and observed UI operation. Never publish tokens or action text in installation logs.
