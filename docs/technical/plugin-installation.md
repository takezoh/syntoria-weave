# Install the ChatGPT plugin

The ChatGPT plugin connects to the independent Cloud Run/PostgreSQL service through Gate OAuth. Use the ChatGPT desktop app with local Work execution for this stdio package. General Remote MCP and stdio client configuration are documented separately in [MCP setup](mcp-installation.md).

## Build from the repository

Execute [INSTALL.md](../../INSTALL.md) for the complete ChatGPT installation procedure. Obtain the deployment-specific MCP URL, Gate issuer and registered public OAuth client ID and build the configured package as that procedure specifies. Reuse supplied local configuration when applicable; request missing connection settings instead of inventing endpoints or registrations.

The repository supplies the server implementation, common UI and portable `plugin.json`/`mcp.json` templates. These shared inputs are not a completed deployment-specific installation. The installation procedure receives the connection settings and constructs the configured package using the existing renderer and builder. It does not generate replacement business logic.

`mcp.json` defines the local stdio launch command. The required Remote MCP URL is stored in the operator-rendered `config.json` alongside issuer and public client ID. Both pieces are needed: the generic launch definition is reusable across deployments, while the installer must include the actual connection settings when constructing the installation package. Preserve private OAuth state outside the installed package.

## Install in ChatGPT

1. Copy the complete configured `dist/plugin/` to a stable local plugin directory, retaining licenses, UI resources and skill references.
2. Use the built-in `@plugin-creator` skill to register this existing folder in the user's personal local marketplace. Reuse a matching entry and preserve other plugins. Keep the supplied portable manifests and local MCP wiring intact.
3. Restart the ChatGPT desktop app, open the Plugins Directory, select the local marketplace and install the plugin. Start a new Work conversation with it enabled. Updating an existing source folder still requires the host's install/refresh lifecycle; a build alone does not refresh its installed cache.

These steps follow the [official local-plugin packaging and installation guidance](https://developers.openai.com/plugins/build/plugins). Registration is local personal installation; this workflow does not publish a directory listing or provision backend resources.

## Connect and accept

Call `connect_action_service` with `{}`. Open the returned authorization URL, sign in through Gate and approve the connection. The callback must reach the machine running the MCP process. Inspect `get_connection_status`, then call `list_actions` for an authenticated read. Call `open_actions` and verify rendered content and tool communication in ChatGPT.

Verify retained drafts and exact-request recovery separately. Keep pending write IDs/arguments through authentication recovery. Status reporting local credentials is not proof of remote acceptance. Valid authorization is reused across calls and restarts; replacing package files must not delete private token state.

Record source commit, package identity, local registration, authenticated read and observed UI/cache behavior without tokens or action text. Local test success does not establish actual ChatGPT installation or rendering. For subsequent updates follow the [update workflow](plugin-workflow.md).
