# Connect an MCP client

This guide configures an MCP client for the deployed service. Installing the ChatGPT plugin follows the separate [ChatGPT procedure](plugin-installation.md).

## Deployment settings

Obtain the authorized deployment's complete HTTPS MCP URL, Gate issuer and registered public OAuth client ID from its operator or existing local configuration. There is no universal MCP URL. Do not derive a production URL from examples, invent a client registration or put deployment settings in tracked source. The server derives user identity from Gate-verified credentials.

## Remote HTTP connection

For a client with Remote MCP and OAuth support, register the supplied MCP URL using its HTTP MCP connection settings and authenticate through Gate. The client must use its registered OAuth callback. Discover tools with `initialize` and `tools/list`, then verify authenticated `list_actions`. UI rendering additionally requires MCP Apps support. This route does not install the local stdio consumer or the ChatGPT plugin.

## Local stdio connection

Use this route for the local consumer that serves the shared UI and forwards operations to the configured Remote MCP. Use Node.js 24 LTS and the pinned package manager.

### Build a configured package

From the selected checkout:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

Set `GATE_ISSUER`, `MCP_URL`, `OAUTH_CLIENT_ID` and `ACTION_DATA_DIRECTORY` in the invoking shell from explicit operator settings. These are inputs to the following command, not automatic server environment configuration. The data directory must be absolute and outside the package. The public client must register exactly `http://127.0.0.1:55437/callback`.

```sh
node scripts/render-plugin.mjs \
  --issuer "$GATE_ISSUER" \
  --resource-endpoint "$MCP_URL" \
  --client-id "$OAUTH_CLIENT_ID" \
  --data-directory "$ACTION_DATA_DIRECTORY"
node scripts/build-plugin.mjs --config .local/dist/action-tools/config.json
```

`dist/plugin/` contains the bundled server, launcher, shared UI, manifests, skill references and licenses. Copy the complete directory to a stable install location. Source checkout and node_modules are not required there. A generic build does not contain `config.json`; rendering and explicit packaging supply the required actual connection settings. To configure an existing installation later, supply its config.json and restart the MCP process. No ChatGPT settings screen or connection tool sets this URL.

### Register the stdio server

Configure your client's stdio entry to execute `node` with the installed `launcher.mjs` absolute path as its argument. Follow that client's configuration syntax. No HTTP URL is used as the stdio transport address: the launcher reads the Remote MCP URL from the packaged `config.json`. `mcp.json` in the package defines the equivalent plugin-managed launch through `${PLUGIN_ROOT}`.

A host-provided `PLUGIN_DATA` can supply the private OAuth directory; otherwise the explicit configured `dataDirectory` is required. Never include token state, DB settings or confidential resource-client/GitHub credentials in the package.

### Authorize and verify

Call `connect_action_service` with `{}`, open its returned URL and complete Gate authentication/connection approval. The browser callback must reach the loopback listener on the machine running this MCP process. Valid saved authorization is reused across calls and restarts. `get_connection_status` reports local state; successful `list_actions` proves current authenticated service access. `disconnect_action_service` clears local authorization; remote revocation uses Gate connection controls.

Call `open_actions` and verify the shared UI in a client supporting MCP Apps. UI tools call this serving local MCP, which forwards exact business operations to the Remote MCP. The service owns user isolation, revision, replay and Undo. Preserve exact IDs/arguments after missing responses; never retry an unknown write with a fresh ID.

Changing the issuer, resource URL or client invalidates the local authorization binding and requires reconnection. Record the source/package identity, connection configuration, authenticated read and actual UI result separately.
