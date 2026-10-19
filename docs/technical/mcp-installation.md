# Connect an MCP client

This guide configures clients for the deployed service. The ChatGPT cloud plugin follows the separate [ChatGPT procedure](plugin-installation.md).

## Deployment settings

Obtain the authorized deployment's complete HTTPS MCP URL, Gate issuer and registered public OAuth client ID from its operator or existing configuration. There is no universal MCP URL. Do not derive a production URL from examples, invent a client registration or put deployment settings in tracked source. The server derives user identity from Gate-verified credentials. An enabled `identity.client_grants` entry must admit the same issuer, verified subject and client ID; Gate client registration alone does not grant access. See [identity and access](infrastructure.md#identity-and-access).

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

Set `GATE_ISSUER`, `MCP_URL`, `OAUTH_CLIENT_ID` and optionally `ACTION_DATA_DIRECTORY` in the invoking shell from authorized operator settings. The data directory must be absolute and private. The public client must register exactly `http://127.0.0.1:55437/callback`, and the corresponding verified subject/client pair must have an enabled Weave client grant.

```sh
node scripts/render-local-mcp-config.mjs \
  --issuer "$GATE_ISSUER" \
  --resource-endpoint "$MCP_URL" \
  --client-id "$OAUTH_CLIENT_ID" \
  --data-directory "$ACTION_DATA_DIRECTORY"
```

The bundle is `dist/local/server.mjs`. Configure the consuming client's stdio entry to execute `node` with that absolute path. Launch it through `pnpm start:local-mcp --config /absolute/path/to/config.json` or the equivalent direct command. The renderer writes the ignored private config to `.local/local-mcp/config.json`; copy it only to a private location and use the same path with `--config`. No local MCP server, launcher or OAuth state is included in `dist/plugin`.

Call `connect_action_service` with `{}`, open its returned URL and complete Gate authentication/approval. The callback reaches the loopback listener on the machine running the local process. `get_connection_status` reports local state; successful `list_actions` proves current authenticated service access. `disconnect_action_service` clears local authorization; Gate's connection controls revoke the remote connection.

Call `open_actions` in a client supporting MCP Apps. UI tools call the local consumer, which forwards exact business operations to Remote MCP. The service owns user isolation, revision, replay and Undo. Preserve exact IDs and arguments after missing responses; never retry an unknown write with a fresh ID. A changed issuer, resource URL or client invalidates the local authorization binding and requires reconnection.
