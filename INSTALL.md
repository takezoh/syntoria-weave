# Install Syntoria Weave in ChatGPT

Syntoria Weave is installed as a private plugin package that requires a Remote MCP app already registered in ChatGPT. The package contains the operation skills and shared UI resource; its `mcp.json` is deliberately empty because `.app.json` binds the required registered connection. It starts no local MCP process. The standalone local MCP consumer has separate instructions in [MCP client setup](docs/technical/mcp-installation.md).

Backend provisioning is independent of plugin installation. The service runs on Cloud Run with Neon PostgreSQL; follow [deployment](docs/technical/deployment.md) only when cloud infrastructure work is requested.

## Register the Remote MCP app

Use the deployed HTTPS MCP endpoint, Gate issuer and registered public OAuth client ID supplied by the deployment operator. Do not infer a production URL or place these values in tracked source. The provided public client uses PKCE S256 and `tokenEndpointAuthMethod: none`; the same issuer, verified subject and client ID need an enabled Weave `identity.client_grants` entry. Gate client registration alone does not grant Weave access. See [identity and access](docs/technical/infrastructure.md#identity-and-access).

In ChatGPT, first inspect the [Plugins page](https://chatgpt.com/plugins) for an existing registered app with the same Remote MCP endpoint, issuer and public client ID. Reuse that app and retain its actual ID. Create a custom MCP app only if no matching registration exists. If a creation attempt has an uncertain result, inspect ChatGPT's registrations and resolve it before retrying; do not create a duplicate. For a new registration, choose **Add custom MCP server**, enter the supplied endpoint, issuer and public client ID, copy the exact callback URI shown by ChatGPT into the Gate client's redirect allowlist, and retain the actual app ID shown by the host. It starts with `plugin_asdk_app`; copy the full value exactly. The callback shown by ChatGPT is authoritative. Do not use the standalone local consumer's `http://127.0.0.1:55437/callback` URI.

Gate currently supports issuer identification, PKCE S256 and token endpoint authentication method `none`; it does not provide dynamic client registration or CIMD. Reuse the existing registered public client. Do not claim that registration, authentication or Weave access succeeded until the host confirms each one.

## Generate the personal package

Use Node.js 24 LTS and the package manager pinned in `package.json`. Keep actual deployment values and the host-issued app ID in the ignored renderer output only.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm render:plugin-config \
  --issuer "$GATE_ISSUER" \
  --resource-endpoint "$WEAVE_MCP_URL" \
  --client-id "$PUBLIC_CLIENT_ID" \
  --registered-plugin-id "$REGISTERED_PLUGIN_ID"
pnpm build:plugin --config .local/dist/action-tools/plugin-settings.json
pnpm verify:plugin
```

Set the shell variables from the authorized deployment and the exact ChatGPT app ID. The renderer writes `.local/dist/action-tools/plugin-settings.json` with private file permissions. A configured build requires a host-shaped `plugin_asdk_app…` ID and fails if it is missing or is the template marker. `pnpm build` without this renderer output creates a noninstallable template with no marketplace entry; never install it.

The configured `dist/plugin` directory is the private marketplace root:

```text
dist/plugin/
  .agents/plugins/marketplace.json
  syntoria-weave/
    plugin.json
    mcp.json
    .app.json
    resources/actions-v4.html
    skills/action-guide/
    skills/action-tools/
    LICENSE
  artifact-manifest.json
```

The marketplace name is `syntoria-weave-personal-marketplace`. It lists `syntoria-weave` from `./syntoria-weave`. The plugin requires `apps.actions` using the exact host-issued ID. Both full operation skills, the shared UI, and the license ship in the package. The package's `mcpServers` object remains empty, so it cannot create a second connection to the same service. Endpoint, issuer and public client ID are renderer inputs and are not copied into the package.

## Install the package and connect its dependency

Register the generated private marketplace root and install its plugin with the supported Codex CLI commands:

```sh
codex plugin marketplace add "$PWD/dist/plugin" --json
codex plugin add syntoria-weave@syntoria-weave-personal-marketplace --json
```

Retain the installed path returned by the host. Verify the installed cache's `plugin.json` references `./.app.json`, that the required `apps.actions.id` matches the full ChatGPT ID, and that its `mcp.json` has an empty `mcpServers`. Confirm both skills and `LICENSE` are present. Reinstall after changing generated package files; editing `dist/plugin` does not update an installed cache.

If ChatGPT has not already confirmed that the registered app's tools are available, use `plugin_management.suggest_plugins` with the exact registered app ID to offer the required connection. Preserve an existing connection and do not reauthenticate it during package updates. A suggestion does not prove the app is installed or authenticated. Continue after the host confirms the connected app's tools are available, then verify authenticated access. Do not treat private marketplace registration or package installation as cloud connection evidence.

## Verify the ChatGPT experience

In a ChatGPT web/cloud session with the Desktop app and standalone local MCP process stopped, discover current tools and perform a read-only authenticated `list_actions`. Open the shared UI with `open_actions`; select saved Action A and call `get_selection_context`, then confirm `selected` contains A's ID and title. Select Action B and confirm the next result contains B. Clear the explicit selection and confirm `selected: []`, even if the active inspector still displays an action. `get_selection_context` reads UI state and must not call the backend. When writes are in scope, also check proposal retention and recovery from an unknown result.

Report source version, artifact inventory/hash, registered app ID, Gate client/grant, package installation, authenticated read, tool refresh and observed selection behavior separately. Do not report credentials or personal action text. A build or local package installation does not establish ChatGPT registration, OAuth access, tool caching, rendered UI or selection acceptance.

For direct stdio MCP clients, use the separate [MCP client setup](docs/technical/mcp-installation.md); that consumer keeps its own loopback callback and private token state.
