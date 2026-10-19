---
change: change-20261019-chatgpt-cloud-plugin
role: implementation
---

<!-- lifecycle is owned by change.md -->

# Implementation

## Content

### Registered app package

- Updated the `syntoria-weave` plugin manifest to version 1.0.3 and made `./.app.json` its required registered-app dependency.
- Restored an empty `mcpServers` object so the personal package cannot add a duplicate raw HTTP connection to the same Remote MCP service.
- Added a strict renderer for the endpoint, Gate issuer, public client ID and actual host-issued `plugin_asdk_app…` ID. It writes only to ignored `.local/dist/action-tools/plugin-settings.json` with private permissions.
- Rebuilt the package generator to emit `dist/plugin` as an install root with `.agents/plugins/marketplace.json` and `syntoria-weave/{plugin.json,mcp.json,.app.json,resources,skills,LICENSE}`. Configured builds bind the actual ID; generic builds carry a clearly reserved ID and an empty marketplace plugin list.
- Bundled both complete `action-guide` and `action-tools` skills, the shared UI HTML and the repository license. The package excludes endpoint, issuer, OAuth client ID, local executables and private state.
- Updated the verifier and CLI regression tests to check required files, dependency mapping, empty MCP servers, marketplace source path, generic noninstallability, hashes, UI identity and rejection of stale files.
- Kept the standalone local MCP renderer and `dist/local` bundle separate.

### Documentation and verification boundary

Updated the install flow, architecture, development guidance and change package. The install instructions reuse an existing matching Remote MCP registration or create one only when absent, retain its exact host ID, generate the configured private package, install it with the supported marketplace and plugin commands, and check the installed cache. They preserve already available app tools and use `plugin_management.suggest_plugins` only when the host has not confirmed that dependency. The instructions distinguish local package evidence from ChatGPT authentication, tool availability, cache refresh and UI acceptance.

The UI resource and `get_selection_context` behavior remain source-owned and unchanged. Actual host registration, connection, authenticated reads and selection acceptance are not claimed by a local build.
