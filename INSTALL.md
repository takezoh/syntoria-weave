# Install Syntoria Weave in ChatGPT

Use Work in the ChatGPT desktop app to build and install the plugin for your deployed Weave service. The plugin supplies action tools, the shared UI and the action-tools skill. Its local MCP server connects to the independent backend through Gate OAuth.

Ask Work:

```text
Read https://github.com/takezoh/syntoria-weave/blob/main/INSTALL.md and build and install Syntoria Weave for me using my deployed service's connection settings. Verify authenticated reads and the shared UI.
```

Supply the deployment's MCP URL, Gate issuer and registered public OAuth client ID, or identify an existing local configuration to reuse. These values vary by deployment. Keep them in local settings outside tracked source. Work also needs a private directory for OAuth state outside the plugin install directory.

Work follows the [install-plugin skill](skills/install-plugin/SKILL.md) and the [ChatGPT installation procedure](docs/technical/plugin-installation.md). The repository supplies the common implementation, UI and definition templates. The skill receives the deployment settings and constructs the configured installation package; the generic template package alone cannot connect to your service. No published plugin-directory listing is required for the personal local-marketplace route.

Complete the returned Gate sign-in/connection approval. Then ask ChatGPT to retrieve your actions and open the list. Confirm both the saved data and actual UI behavior. Authorization is reused across calls and restarts.

For updates, ask Work to read the latest [update-plugin skill](skills/update-plugin/SKILL.md) and update the installation while preserving its configuration and private OAuth state.

For a general MCP client, use the separate [MCP setup guide](docs/technical/mcp-installation.md). Backend provisioning follows [deployment](docs/technical/deployment.md). Actual ChatGPT installation and UI acceptance must be observed; repository tests alone do not establish them.
