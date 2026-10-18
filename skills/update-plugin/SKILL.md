---
name: update-plugin
description: Build and update the local MCP plugin, refresh its shared UI resources and verify authenticated service access. Use when the user requests an update to this application's plugin.
---

# Update the installed plugin

Follow the [plugin update workflow](../../docs/technical/plugin-workflow.md). Build and verify the selected source, reuse the installation’s deployment-specific MCP URL/issuer/public-client settings, render them outside tracked source, construct the configured package from the common server/UI/templates, and use the client's supported update mechanism.

Preserve private OAuth state outside the install directory and preserve the authorized service/client configuration. Do not deploy backend infrastructure or reset business data as part of a plugin update. Missing write responses retain their exact original operation IDs and arguments.

Verify discovery, authenticated reads and actual resource/UI behavior separately. A build does not prove installation or client cache refresh. For initial setup execute [INSTALL.md](../../INSTALL.md) directly.
