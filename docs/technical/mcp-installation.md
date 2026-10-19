# Connect an MCP client

This guide configures clients for the deployed service. The ChatGPT cloud plugin follows the separate [ChatGPT procedure](plugin-installation.md).

## Deployment settings

Obtain the authorized deployment's complete HTTPS MCP URL and Gate issuer from its operator or existing configuration. There is no universal MCP URL. Do not derive a production URL from examples or put deployment settings in tracked source. The server derives user identity from Gate-verified credentials. Weave separately requires the verified issuer and subject to map to an enabled user; Gate client registration alone does not grant access. See [identity and access](infrastructure.md#identity-and-access).

## Remote HTTP connection

For a client with Remote MCP and OAuth support, register the supplied MCP URL using its HTTP MCP connection settings and authenticate through Gate with that client's registered callback. Discover tools with `initialize` and `tools/list`, then verify authenticated `list_actions`. UI rendering additionally requires MCP Apps support. This route does not install a local consumer or the ChatGPT plugin.

## Standalone local stdio consumer

Use this route only for clients that need the standalone local consumer to serve the shared UI and forward operations to Remote MCP. It is independent of the ChatGPT cloud plugin. Use Node.js 24 LTS and the pinned package manager.

Build the local bundle from the selected checkout:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

Set `GATE_ISSUER` and `MCP_URL` in the invoking shell from authorized operator settings. On connection, the local consumer dynamically registers a public native client with Gate using exactly `http://127.0.0.1:55437/callback` and PKCE S256. Weave access still depends on the verified issuer and subject mapping.

```sh
node scripts/render-local-mcp-config.mjs \
  --issuer "$GATE_ISSUER" \
  --resource-endpoint "$MCP_URL"
```

The renderer omits the state path in this configuration. Set the consuming host's `PLUGIN_DATA` environment variable to an absolute, private, persistent directory when launching the process. Alternatively, bind the path into the config by adding `--data-directory /absolute/private/path` to the renderer command; that directory must remain outside the plugin install.

The bundle is `dist/local/server.mjs`. Configure the consuming client's stdio entry to execute `node` with that absolute path. Launch it through `pnpm start:local-mcp --config /absolute/path/to/config.json` or the equivalent direct command. The renderer writes the ignored private config to `.local/local-mcp/config.json`; copy it only to a private location and use the same path with `--config`. No local MCP server, launcher or OAuth state is included in `dist/plugin`.

Call `connect_action_service` with `{}`, open its returned URL and complete Gate authentication/approval. The callback reaches the loopback listener on the machine running the local process. The private SQLite state stores the dynamic client registration separately from credentials, retains it across process restarts and disconnects, and reuses it for refreshes. `get_connection_status` reports local state; successful `list_actions` proves current authenticated service access. `disconnect_action_service` clears local credentials and pending authorization; Gate's connection controls revoke the remote connection.

Call `open_actions` in a client supporting MCP Apps. UI tools call the local consumer, which forwards exact business operations to Remote MCP. The service owns user isolation, revision, replay and Undo. Preserve exact IDs and arguments after missing responses; never retry an unknown write with a fresh ID. A changed issuer, resource URL, callback or local OAuth profile invalidates the local authorization binding and requires a new connection.
