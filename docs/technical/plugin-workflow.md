# ChatGPT personal plugin updates

The Syntoria Weave package uses a required ChatGPT app dependency for the deployed Remote MCP service. It does not bundle a duplicate HTTP server entry or depend on a local MCP process. Initial setup follows [INSTALL.md](../../INSTALL.md); the [update-plugin skill](../../skills/update-plugin/SKILL.md) routes package and host updates here.

## Build the package

Keep the deployed HTTPS MCP URL, Gate issuer, existing registered public client ID and exact host-issued app ID in ignored `.local/` renderer settings. The issuer, verified subject and client ID also require an enabled Weave `identity.client_grants` entry. ChatGPT supplies the exact OAuth callback; add that URI to the Gate client. The direct consumer's loopback callback does not belong to ChatGPT.

```sh
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

The generic build has a template-only app ID and no marketplace entry, so it cannot be installed as the personal package. The configured build emits the private install root with `syntoria-weave-personal-marketplace`, the `syntoria-weave` package, required `.app.json` mapping, empty `mcpServers`, both operation skills, shared UI, `LICENSE` and the hash inventory. The package carries no endpoint, issuer, client ID or local runtime.

## Install and refresh

Install the generated root through the supported CLI:

```sh
codex plugin marketplace add "$PWD/dist/plugin" --json
codex plugin add syntoria-weave@syntoria-weave-personal-marketplace --json
```

Check the installed cache and exact required app ID. In ChatGPT, use `plugin_management.suggest_plugins` with that ID only if the host has not already confirmed that its tools are available. Preserve an existing connection when updating the package. Wait for host confirmation; the suggestion alone is not connection evidence.

After a package or skill change, rebuild and reinstall the package. After a server registration change, refresh the registered tools, then start a new chat for current resources. In a ChatGPT web/cloud session with the Desktop app and local MCP process stopped, verify authenticated reads and open the shared UI. Select Action A and Action B in turn and call UI-local `get_selection_context`; then clear explicit selection and verify `selected: []`, even while an active item is displayed. These checks confirm UI context separately from the backend operations.

## Evidence boundary

The artifact verifier proves package layout, manifest shape, required skills, local dependency mapping, hashes and UI-resource identity. It does not prove app registration, host installation, OAuth, tool availability, resource cache refresh, rendering or selection behavior. Record source version, artifact inventory, actual host app ID, Gate client/grant, installed cache, authenticated read and observed UI behavior separately. A local or mock check cannot replace host acceptance.
