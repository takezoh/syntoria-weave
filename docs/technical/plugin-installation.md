# ChatGPT personal plugin package

The full user procedure is [INSTALL.md](../../INSTALL.md). ChatGPT must first have the deployed Remote MCP service registered as an app. The private Syntoria Weave package consumes that registered app through `.app.json`; it does not declare a second transport in `mcp.json` and starts no local process. The standalone local MCP consumer is described separately in [MCP client setup](mcp-installation.md).

The package identity is `syntoria-weave` with display name `Syntoria Weave`. Its private marketplace is `syntoria-weave-personal-marketplace`. Both `action-guide` and `action-tools`, the shared UI resource and `LICENSE` are included in each generated package.

## Render and verify

Use the deployed HTTPS MCP endpoint, Gate issuer and exact host-issued ChatGPT app ID. Reuse a matching registered app whose OAuth connection uses dynamic client registration (DCR). Confirm the host registration uses DCR before authorizing; do not supply a fixed OAuth client ID or manually register ChatGPT's callback. Registration alone does not authorize access: Gate verifies the configured person and requires connection approval, while Weave requires an enabled issuer/subject mapping. Resolve uncertain host app creation results before retrying to avoid duplicates. See [identity and access](infrastructure.md#identity-and-access).

```sh
pnpm build
pnpm render:plugin-config \
  --issuer "$GATE_ISSUER" \
  --resource-endpoint "$WEAVE_MCP_URL" \
  --registered-plugin-id "$REGISTERED_PLUGIN_ID"
pnpm build:plugin --config .local/dist/action-tools/plugin-settings.json
pnpm verify:plugin
```

The private renderer output stays under ignored `.local/`. A generic build is marked noninstallable and has no marketplace entry. A configured build requires the actual `plugin_asdk_app…` ID. The resulting `dist/plugin` is the personal install root: `.agents/plugins/marketplace.json` points to `./syntoria-weave`; its package includes `plugin.json`, an empty `mcpServers`, `.app.json` with the required registered app mapping, both operation skills, the shared UI resource, `LICENSE` and a hash inventory. The endpoint and issuer are not packaged.

## Install and refresh

Register the generated local marketplace and install the package:

```sh
codex plugin marketplace add "$PWD/dist/plugin" --json
codex plugin add syntoria-weave@syntoria-weave-personal-marketplace --json
```

Verify the installed cache path returned by the host. Confirm `plugin.json` points to `.app.json`, the exact registered app ID is required, `mcpServers` is empty, and both skills and `LICENSE` are present. If ChatGPT has not already confirmed that the app's tools are available, use `plugin_management.suggest_plugins` with that exact ID to offer the required connection. Preserve an existing DCR connection during package updates. The host must separately confirm that the app is installed, authenticated and its tools are available.

After changing the server registration, refresh its ChatGPT tools, then start a new chat to load current resources. After changing package definitions or skills, rebuild and reinstall the package before host checks. These package, connection and host cache steps are distinct. The artifact verifier checks local package structure and content; it does not establish ChatGPT registration, OAuth, tool discovery, UI rendering or selection behavior.

In a ChatGPT web/cloud session with the Desktop app and local MCP process stopped, verify authenticated `list_actions`, open `open_actions`, and use `get_selection_context` for a selected Action A, a selected Action B and a cleared explicit selection. The cleared result must report `selected: []` even if an active item remains. This UI-local read does not call the backend. Report actual host observations separately from local build and install evidence.
