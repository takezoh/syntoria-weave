---
name: install-plugin
description: Build and install the action-service ChatGPT plugin using deployment-specific MCP and OAuth settings. Use for initial installation; use update-plugin for an existing installation.
---

# Build and install the plugin

Use the shared source and definition templates to construct a configured plugin for the user's deployment. A generic package is not a ready-to-connect installation. Read the [ChatGPT installation procedure](../../docs/technical/plugin-installation.md) and its linked build/configuration steps.

Obtain the complete Remote MCP URL, Gate issuer, registered public OAuth client ID and explicit private data directory from the user or their identified local configuration. Reuse supplied settings; ask only for missing values. Never infer a production endpoint from examples, invent client registrations or request confidential resource-client/DB/GitHub secrets. The public client's registered callback must match the local consumer's loopback callback.

Build the common MCP implementation and shared UI. Render the supplied connection settings using scripts/render-plugin.mjs, then construct the installation package with scripts/build-plugin.mjs and its explicit --config argument. Verify that the resulting config.json contains the intended resourceEndpoint, issuer and clientId, and that token data remains outside the package. Keep deployment settings out of tracked source.

Install the complete configured folder through ChatGPT's supported personal local-marketplace flow, reusing a matching registration. When available, use the host's plugin-creator skill to register the existing folder; preserve the repository's portable manifest templates and stdio transport. Record the actual registration identity rather than inventing host IDs. Provisioning backend infrastructure or publishing to a public directory is outside this workflow.

After the host reload/install, invoke connect_action_service with {} and have the user complete the returned Gate authorization flow. This tool authenticates the configured endpoint; it does not accept or configure a URL. Verify get_connection_status, authenticated list_actions and actual open_actions rendering/tool communication separately. Keep exact operation IDs/arguments after unknown write outcomes.

Report the source commit, configured package and installed identity, successful checks and any unobserved host steps. A local build does not establish installation or actual ChatGPT UI acceptance. General MCP client connection belongs to the separate [MCP setup guide](../../docs/technical/mcp-installation.md).
