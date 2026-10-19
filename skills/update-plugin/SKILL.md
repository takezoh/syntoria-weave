---
name: update-plugin
description: Build and update the ChatGPT cloud plugin manifest artifact, refresh host tool and UI resources, and verify the registered connection. Use when the user requests an update to this application's ChatGPT plugin.
---

# Update the installed plugin

Follow the [plugin update workflow](../../docs/technical/plugin-workflow.md). Rebuild the private package with the deployed MCP URL, Gate issuer, registered public client ID and exact host-issued `plugin_asdk_app…` ID in the ignored renderer config. Verify the package, reinstall it through its marketplace, then refresh the registered app's ChatGPT tools and start a new chat to load current tools and UI resources.

The personal package requires the registered Remote MCP app through `.app.json` and keeps `mcp.json` empty. Preserve the actual host-issued ID and authorized Gate client configuration. Do not deploy backend infrastructure or reset business data as part of a package update. Missing write responses retain their exact original operation IDs and arguments. The standalone local MCP consumer has a separate configuration and lifecycle.

Verify the installed cache mapping and included skills, then verify host connection, tool refresh and new-chat UI-resource loading separately. A build does not prove installation, registration, authentication or client cache refresh. For initial setup follow [INSTALL.md](../../INSTALL.md) directly.
