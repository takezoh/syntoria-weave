# Syntoria Weave plugin installation

The plugin packages a local MCP server, the shared action UI and the action-tools skill. The local server connects to the deployed Remote MCP through Gate OAuth. The SPA and MCP resource use the same generated UI. Backend provisioning follows the [deployment guide](docs/technical/deployment.md).

Use Node.js 24 LTS on the machine running the local MCP server. Obtain the authorized service's issuer, MCP endpoint, public OAuth client ID and registered loopback callback from the operator. Keep deployment settings and the private connection-data directory outside source and the installed plugin directory.

Build from the selected checkout:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

Render explicit `issuer`, `resourceEndpoint` (the complete HTTPS MCP endpoint), `clientId`, and an absolute `dataDirectory` outside the plugin install directory. The following reserved example values must be replaced with authorized operator settings. Use the existing registered public client and exact callback `http://127.0.0.1:55437/callback`.

```sh
node scripts/render-plugin.mjs \
  --issuer https://identity.example.invalid \
  --resource-endpoint https://actions.example.invalid/mcp \
  --client-id action-tools-client \
  --data-directory /absolute/private/action-tools
node scripts/build-plugin.mjs --config .local/dist/action-tools/config.json
```

Install the complete `dist/plugin/` directory with your client's supported local-plugin mechanism. It contains root `plugin.json` and `mcp.json`, the bundled server, UI and skill resources. The client must support local stdio MCP with Node.js 24. A host-provided `PLUGIN_DATA` may supply the private directory; otherwise the explicit `dataDirectory` is required. Do not place token state inside the package.

In the connected MCP client, call `connect_action_service` with `{}` and open its returned authorization URL. Sign in and complete the requested connection approval. The local callback finishes the connection. Valid saved authorization is reused across calls and restarts. `get_connection_status` reports connection state; `disconnect_action_service` clears the local authorization. Follow the actual tool output for the scope of remote revocation.

Call `list_actions` and `open_actions` to check authenticated data access and the UI. The resource's controls call this same local MCP server, which forwards exact business operations to the Remote MCP service. The service owns user isolation, revision, replay and Undo. Preserve exact IDs and arguments after a missing response; do not retry a write using a new operation ID.

A client may also connect directly to the service's HTTPS Remote MCP with supported OAuth and MCP Apps UI. The dedicated browser SPA uses its configured Gate session. Neither route depends on plugin installation.

Record the package/source version, configuration identity, authentication result and observed resource/UI behavior separately. Successful local tests do not prove installation, UI rendering or resource cache refresh in a particular client.
