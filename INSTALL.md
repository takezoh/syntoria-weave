# Install Syntoria Weave

Build and install a personal ChatGPT plugin connected to the user's existing Weave service. Execute this procedure in ChatGPT Work with local computer access in the desktop app. Use Node.js 24 LTS and the packageManager version in package.json. Backend provisioning is separate; follow [deployment](docs/technical/deployment.md) only when explicitly requested. General MCP client setup has its own [guide](docs/technical/mcp-installation.md).

## Select the service and installation

1. Obtain the user's complete HTTPS Remote MCP URL, Gate issuer and registered public OAuth client ID from supplied settings or an identified existing configuration. Ask only for missing values. The URL varies by deployment; do not infer it from examples or commit it to source.
2. Confirm that the public client registers exactly `http://127.0.0.1:55437/callback`. Authentication must use that existing public client; no DB, GitHub or confidential resource-client secret is needed.
3. Inspect the existing personal plugin/marketplace entry when updating. Retain its actual registration identity, configuration and private OAuth state. For a new installation choose a stable local package directory and a separate private data directory. Keep token state outside the package and host's install cache.
4. Use the source branch requested for the installation and record its commit. Read the current [action-tools contract](skills/action-tools/SKILL.md); no installation skill is delivered to the plugin.

## Build the configured plugin

From the selected source checkout:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

Set the invoking shell's `GATE_ISSUER`, `MCP_URL`, `OAUTH_CLIENT_ID` and `ACTION_DATA_DIRECTORY` to the supplied settings and chosen absolute private data path. They are explicit renderer inputs. Do not print tokens or secret environment values.

```sh
node scripts/render-plugin.mjs \
  --issuer "$GATE_ISSUER" \
  --resource-endpoint "$MCP_URL" \
  --client-id "$OAUTH_CLIENT_ID" \
  --data-directory "$ACTION_DATA_DIRECTORY"
node scripts/build-plugin.mjs --config .local/dist/action-tools/config.json
```

The common implementation/UI and definition templates are source inputs. The configured `dist/plugin/` is the installable output. Inspect its generated `config.json` for the selected `resourceEndpoint`, `issuer` and `clientId`. The required Remote MCP URL belongs in that file; `mcp.json` defines the local stdio launcher. A generic build without config.json cannot connect to the service.

Verify the artifact-manifest.json hashes and that resources/actions-v4.html equals dist/spa/workspace.html. The package must include its launcher/server, manifests, UI resource, action-tools skill/references and licenses. It must exclude private token state and confidential backend credentials. The builder distributes only skills/action-tools; construction and update instructions remain in this source checkout.

## Register and install in ChatGPT

1. Copy the complete configured `dist/plugin/` to the selected stable local package directory. Preserve any existing private data directory. The installed copy does not require this checkout or node_modules.
2. Add or update only the matching entry in the user's personal marketplace at `~/.agents/plugins/marketplace.json`. Preserve other entries. The host's built-in `@plugin-creator`, when available, can register the existing configured folder; retain the supplied portable manifests and stdio wiring.
3. For manual registration, use the [official local-marketplace format](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually). Include marketplace name and the plugin entry's name, local source, installation/authentication policies and category. The plugin name is `syntoria-weave` and its host display name is `Syntoria Weave`. Retain these values from the generated plugin.json, including extensions.com.openai.interface.displayName. Resolve source.path relative to the marketplace root and point it at the stable configured folder, not the source templates. For example, a personal folder `~/.codex/plugins/syntoria-weave` uses `./.codex/plugins/syntoria-weave` under the home-rooted personal marketplace.
4. Restart the ChatGPT desktop app. Open the Plugins Directory, choose the local marketplace and install or refresh its entry. Record the actual registration returned/shown by the host; do not invent plugin IDs. Start a new Work conversation with the plugin enabled so it loads current tools/resources. Creating files alone does not complete installation or refresh the host's installed cache.

For a new personal entry, the following is a concrete example for the package directory above. Merge the entry into an existing catalog rather than replacing that catalog. Reuse existing names when updating.

```json
{
  "name": "syntoria-weave-personal-marketplace",
  "interface": {"displayName": "Personal Plugins"},
  "plugins": [
    {
      "name": "syntoria-weave",
      "source": {
        "source": "local",
        "path": "./.codex/plugins/syntoria-weave"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_USE"
      },
      "category": "Productivity"
    }
  ]
}
```

## Authenticate and verify

1. Discover the installed tools and call `connect_action_service` with `{}`. This authenticates the endpoint already in config.json; it does not accept a URL or configure a connection.
2. Have the user open the returned URL and complete Gate sign-in/connection approval. The browser callback must reach the loopback listener on the machine running MCP.
3. Call `get_connection_status`, then `list_actions` for an authenticated read. Local credential presence alone does not prove service acceptance.
4. Call `open_actions` and inspect actual ChatGPT rendering and tool communication. Verify retained proposals and unknown-result recovery separately. Missing write responses retain exact tool names, operation IDs and arguments; do not create fresh IDs to retry.

Valid authorization is reused across calls and restarts. A later issuer, MCP URL or client change requires updating the local configuration, restarting the MCP process and reconnecting. Remote revocation uses Gate connection controls; disconnect_action_service clears local authorization.

## Update an existing installation

Use the [update-plugin skill](skills/update-plugin/SKILL.md) and [update workflow](docs/technical/plugin-workflow.md). Rebuild with the existing deployment settings and preserve private OAuth state outside the replacement package. The installation procedure itself is not a skill bundled for everyday action management.

## Report the result

Report source commit, configured artifact identity/hash, selected service configuration, actual plugin registration, authenticated-read result and observed UI/cache behavior. Exclude tokens and personal action text. Mark any installation, authentication or rendering step not observed as incomplete; local tests do not establish ChatGPT acceptance.
