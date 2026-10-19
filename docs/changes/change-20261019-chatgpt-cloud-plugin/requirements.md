---
change: change-20261019-chatgpt-cloud-plugin
role: requirements
---

<!-- lifecycle is owned by change.md -->

# Requirements

## Content

The user creates or selects the deployed Remote MCP app in ChatGPT using its HTTPS endpoint, Gate issuer and registered public OAuth client. The package is a separate private personal package that consumes this host registration through `plugin.json`'s `extensions.com.openai.apps` reference to `./.app.json`. Its app mapping uses the exact host-issued `plugin_asdk_app…` ID with `required: true`. The package's `mcp.json` has an empty `mcpServers` object so it cannot declare a second connection to the same service.

The generated personal install root contains `.agents/plugins/marketplace.json`, the `syntoria-weave` package, both complete operation skills (`action-guide` and `action-tools`), the shared UI resource, and `LICENSE`. The private marketplace name is `syntoria-weave-personal-marketplace` and its source path is `./syntoria-weave`. The install instructions cover reuse or creation of the registered app without duplicates, the supported marketplace registration and plugin add commands, verification of the installed cache and conditional use of `plugin_management.suggest_plugins` with the actual app ID.

The generic build remains usable without operator settings but is visibly noninstallable and cannot list an installable marketplace package. Configured settings include the public endpoint, issuer, public client ID and actual registered app ID in ignored renderer output. Configured builds reject a missing or template app ID. The distributed package does not contain the endpoint, issuer or OAuth client ID, a local executable, token state or credentials. The standalone local stdio consumer remains separately rendered and built under `dist/local`.

Documentation includes ChatGPT registration and package installation, keeps Cloud Run/Gate registration separate from Sites provisioning, and separates local package installation, host connection, tool refresh, resource cache refresh and acceptance. Acceptance instructions verify authenticated `list_actions` and `get_selection_context` for selected Action A, selected Action B and cleared explicit selection, with the Desktop app and local MCP process stopped.

The change does not create a production registration, change deployed identity grants, deploy service infrastructure, connect a host app or alter source UI behavior. Actual ChatGPT registration, authentication, app connection, tool refresh and UI acceptance remain host-only evidence.
