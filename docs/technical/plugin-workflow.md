# Plugin updates

The plugin release contains a runnable local MCP server, the shared UI resource and the action-tools skill. Backend releases follow [deployment](deployment.md); distribute plugin artifacts independently of Cloud Run or SPA deployment.

## Build and configure

Initial ChatGPT installation uses [install-plugin](../../skills/install-plugin/SKILL.md). Updates use [update-plugin](../../skills/update-plugin/SKILL.md). Both construct the installation package from shared implementation/templates and deployment-specific connection settings. The Remote MCP URL is required in the generated config.json; a generic package alone is not a configured installation.

Use the pinned Node.js and package manager. Run the required checks, then build the plugin from the selected source version. Render only public endpoint/client settings and the explicit private data-directory path into an ignored operator-specific artifact. Never distribute token state, database settings, resource-client secrets or GitHub credentials.

```sh
pnpm check
pnpm build
node scripts/render-plugin.mjs \
  --issuer https://identity.example.invalid \
  --resource-endpoint https://actions.example.invalid/mcp \
  --client-id action-tools-client \
  --data-directory /absolute/private/action-tools
node scripts/build-plugin.mjs --config .local/dist/action-tools/config.json
```

The renderer accepts explicit issuer, resource endpoint, registered public client ID and optional private data-directory flags; it writes `.local/dist/action-tools/config.json`. Replace the reserved example values with authorized operator settings. The generic build does not implicitly load local deployment settings.

Copy the complete package, including licenses, resources and skill references. Preserve the existing connection data outside the install directory. An endpoint/client/issuer change requires a new OAuth connection; replacing program files alone must not erase private credentials or prompt for a new approval on every call.

## Refresh the client

Update the existing local plugin using the client's supported installation mechanism. Restart its MCP process and request current tool discovery and resources in a supported fresh session. Keep the existing connection identity and access scope. Do not infer resource cache refresh from a successful build or API deployment.

## Verify

Check `get_connection_status`, authenticated `list_actions`, `open_actions` resource association, actual UI rendering and calls through the local server. Verify retained drafts and exact-request recovery separately from authentication. A direct Remote MCP connection has its own tool/resource refresh and acceptance.

Record the source commit, artifact inventory/hash, endpoint configuration identity, client installation identity and observed results. Distinguish build validation, authenticated service access and actual client UI acceptance. Do not publish tokens or action text in logs.
