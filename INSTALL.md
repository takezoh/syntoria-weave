# Install Syntoria Weave in ChatGPT

Syntoria Weave is installed as a private plugin package that requires a Remote MCP app already registered in ChatGPT. The package contains the operation skills and shared UI resource; its `mcp.json` is deliberately empty because `.app.json` binds the required registered connection. It starts no local MCP process. The standalone local MCP consumer has separate instructions in [MCP client setup](docs/technical/mcp-installation.md).

Backend provisioning is independent of plugin installation. The service runs on Cloud Run with Neon PostgreSQL; follow [deployment](docs/technical/deployment.md) only when cloud infrastructure work is requested.

## Resolve the registered Remote MCP app

The package identity is fixed: `syntoria-weave`, displayed as `Syntoria Weave`, installed as `syntoria-weave@syntoria-weave-personal-marketplace`. These package names are not the registered Remote MCP app ID. Use the deployment's known HTTPS MCP endpoint and Gate issuer; do not infer a production URL or place these values in tracked source. ChatGPT uses Gate dynamic client registration and PKCE for its OAuth connection. Gate registration alone does not grant Weave access; Weave separately requires the verified issuer and subject to map to an enabled user. See [identity and access](docs/technical/infrastructure.md#identity-and-access).

Resolve the registered app ID from available host information; do not ask the user to look it up or paste it:

1. Run the supported inventory command and locate the installed package by its fixed name. Inspect its reported installation/cache location, then read `plugin.json`. If `extensions.com.openai.apps` points to `./.app.json`, read that file and take the required `apps.actions.id` as the candidate registered app ID. Do not treat the package name, display name or any local wrapper `pluginId` as this ID.

   ```sh
   codex plugin list --json
   ```

2. Inspect existing ignored renderer settings and installation records, including `.local/dist/action-tools/plugin-settings.json`. Reuse `registeredPluginId` only when its endpoint, issuer, and Gate OAuth registration mode match the deployment values. The supported mode is Gate dynamic client registration (DCR).
3. Verify the candidate against the actual registered ChatGPT connection: match its name (`Syntoria Weave`), the exact known Remote MCP endpoint and issuer, and that its OAuth connection uses Gate DCR. A legacy local stdio package may not contain `.app.json`; in that case continue to the host's registered-app management view and resolve the matching connection there.
4. Public plugin search and dependency listings are global listings. A missing result from search or `get_plugin_dependencies` does not establish that a private registered app is absent. Do not ask the user to paste an app ID or choose between an ID and “unregistered.”
5. If inspection confirms there is no matching registration, create it through the supported ChatGPT host flow and consume the ID returned by that flow. If the existing connection uses a legacy fixed-client OAuth registration, switch it to the supported DCR OAuth registration and reauthorize it. Preserve its ChatGPT app ID if the host supports that migration; if a replacement connection is required, resolve the actual app ID returned by the host and rebuild the package dependency with that ID. Do not assume an already-connected legacy registration remains usable after the OAuth mode change. If the creation or migration result is uncertain, inspect registrations and resolve the outcome before retrying; do not create a duplicate or fabricate an ID from the package name. If the host does not expose a capability needed to inspect, migrate, or create the registration, report that specific limitation instead of asking the user for the ID.

For a new connection, choose **Add custom MCP server** and enter the known endpoint and issuer. ChatGPT performs dynamic client registration with Gate as part of its OAuth connection; do not supply a fixed public client ID or preregister a callback. The local consumer's `http://127.0.0.1:55437/callback` URI is for a separate native client. Keep the resolved full `plugin_asdk_app…` ID as an installer value; do not request it from the user.

Gate uses RFC 7591 dynamic client registration for public clients, PKCE S256, and token endpoint authentication method `none`. Do not claim that registration, authentication or Weave access succeeded until the host confirms each one.

## Generate the personal package

Use Node.js 24 LTS and the package manager pinned in `package.json`. Keep actual deployment values and the resolved host-issued app ID in the ignored renderer output only. The installer must populate `REGISTERED_PLUGIN_ID` from the resolution steps above; it is not a user-provided setting.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm render:plugin-config \
  --issuer "$GATE_ISSUER" \
  --resource-endpoint "$WEAVE_MCP_URL" \
  --registered-plugin-id "$REGISTERED_PLUGIN_ID"
pnpm build:plugin --config .local/dist/action-tools/plugin-settings.json
pnpm verify:plugin
```

Set the endpoint and issuer shell variables from the authorized deployment, then set `REGISTERED_PLUGIN_ID` from the installer-resolved matching ChatGPT connection. The renderer writes `.local/dist/action-tools/plugin-settings.json` with private file permissions. A configured build requires a host-shaped `plugin_asdk_app…` ID and fails if it is missing or is the template marker. `pnpm build` without this renderer output creates a noninstallable template with no marketplace entry; never install it.

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

The marketplace name is `syntoria-weave-personal-marketplace`. It lists `syntoria-weave` from `./syntoria-weave`. The plugin requires `apps.actions` using the exact host-issued ID. Both full operation skills, the shared UI, and the license ship in the package. The package's `mcpServers` object remains empty, so it cannot create a second connection to the same service. Endpoint and issuer are renderer inputs and are not copied into the package.

## Install the package and connect its dependency

Register the generated private marketplace root and install its plugin with the supported Codex CLI commands:

```sh
codex plugin marketplace add "$PWD/dist/plugin" --json
codex plugin add syntoria-weave@syntoria-weave-personal-marketplace --json
```

Retain the installed path returned by the host. Verify the installed cache's `plugin.json` references `./.app.json`, that the required `apps.actions.id` matches the full ChatGPT ID, and that its `mcp.json` has an empty `mcpServers`. Confirm both skills and `LICENSE` are present. Reinstall after changing generated package files; editing `dist/plugin` does not update an installed cache.

If ChatGPT has not already confirmed that the registered app's tools are available, use `plugin_management.suggest_plugins` with the exact registered app ID to offer the required connection. Preserve an existing DCR connection during ordinary package updates; changing from the legacy fixed-client OAuth mode requires the migration and reauthorization described above. A suggestion does not prove the app is installed or authenticated. Continue after the host confirms the connected app's tools are available, then verify authenticated access. Do not treat private marketplace registration or package installation as cloud connection evidence.

## Verify the ChatGPT experience

In a ChatGPT web/cloud session with the Desktop app and standalone local MCP process stopped, discover current tools and perform a read-only authenticated `list_actions`. Open the shared UI with `open_actions`; select saved Action A and call `get_selection_context`, then confirm `selected` contains A's ID and title. Select Action B and confirm the next result contains B. Clear the explicit selection and confirm `selected: []`, even if the active inspector still displays an action. `get_selection_context` reads UI state and must not call the backend. When writes are in scope, also check proposal retention and recovery from an unknown result.

Report source version, artifact inventory/hash, registered app ID, Gate OAuth connection, package installation, authenticated read, tool refresh and observed selection behavior separately. Do not report credentials or personal action text. A build or local package installation does not establish ChatGPT registration, OAuth access, tool caching, rendered UI or selection acceptance.

For direct stdio MCP clients, use the separate [MCP client setup](docs/technical/mcp-installation.md); that consumer keeps its own loopback callback and private token state.
