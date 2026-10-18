---
change: change-20261018-plugin-independent-runtime
role: implementation
---

# Implementation plan

## Accepted boundaries

The local MCP is an explicit public OAuth consumer of the existing service, using PKCE S256 and the registered loopback callback. It serves the common UI resource and forwards calls on that same MCP transport. It is neither a database client nor a confidential Gate resource client. Tokens live in private per-install data outside the plugin bundle. No additional cloud service, BFF or load balancer is introduced.

The runtime cleanup removes Sites composition and its authentication/storage/build selection. D1 remains an isolated adapter with its adapter schema/contracts; recorded SQL migration identifiers and historical evidence are preserved. The Node application and PostgreSQL are the live authority.

## Implementation units

1. Retire Sites runtime composition, align D1 adapter boundaries, update dependent tests and supported build paths.
2. Implement the local OAuth consumer, shared resource serving and portable plugin packaging; verify a freshly unpacked artifact.
3. Align current documentation and installation/update instructions, then run full checks and integration acceptance.

OAuth metadata/token/MCP fetches reject redirects. Callback state is one-use and bounded; port conflicts fail without taking over another flow. Refresh/token persistence is serialized across consumers of one private data directory. Remote JSON-RPC results and errors remain distinguishable, and unknown mutations are never automatically retried.

## Design evidence

The delegated design artifact was independently reviewed against code and approved. Its formal design loop could not finish because the checkout changed during the read-only snapshot; this is not represented as formal loop success. Implementation units retain their own verification and independent review. The root accepted the reviewed boundary contract and owns integration.

## Implemented integration

The local consumer uses shared pure tool definitions, a bundled maintained OIDC client, a private SQLite credential-state adapter and exact Remote MCP forwarding. The SPA and local resource derive from the same widget source. Root manifests, launcher, resource, skill references and dependency licenses are packaged with a SHA-256 inventory. Operator endpoints and token state stay outside tracked source.

Independent review found and closed two defects: host `PLUGIN_DATA` was not forwarded to the connection owner; a rejected token prevented the documented reconnect path. The fix conditionally invalidates only the rejected current token, preserves newer authorization against delayed responses and distinguishes permission denial from authentication failure.

Root integration removes the remaining hosting manifest/source overview and updates current architecture, installation/update guidance, operation skills and active design facts. Applied migrations and historical evidence remain intact. A historical note links its removed entry to the preserved source commit. Docker installation retains the neutral package-manager security policy; generated cache exclusions do not select a runtime.

The runtime-retirement invocation ended `execution-mutation-outside-scope` for required ancillary files; root explicitly expanded the integration scope, reviewed the changes and records actual tests separately. It is not a formal success claim. The local consumer implementation loop and independent re-review reached `SUCCEEDED` / `all-required-current`. Nested design metadata required the documentation tool's canonical parser/serializer because its patch CLI accepts only top-level scalar/list operations; schema lint verifies the resulting documents.

A clean frozen install exposed an undeclared Next.js parser dependency in the inherited lint preset. Integration replaces the framework preset with its existing `typescript-eslint` 8.59.3 recommended configuration, keeping the same parser/plugin version and architecture rules without restoring a framework runtime. Package-manager store paths are explicit during local validation because sandbox and host defaults differ; this changes cache placement only. Unreachable lock records are removed by reachability over the preserved importer/snapshot graph, with frozen installation validating the result.

## Deployment-specific installation workflow

README restores the ChatGPT Work installation request. INSTALL.md directly specifies construction, local registration, installation, authentication and acceptance, with update-plugin for an existing installation. General Remote HTTP/local stdio MCP configuration has its own guide, separate from ChatGPT marketplace registration and rendered UI acceptance.

The repository provides shared implementation/UI and definition templates. A usable installation requires the deployment's Remote MCP URL, issuer and registered public client ID in generated config.json. The installer obtains those values and constructs the configured package using the existing renderer/builder. mcp.json defines local stdio startup; connect_action_service only authenticates the configured service and cannot set its URL. Later file-based configuration requires restarting the MCP process. No runtime code or credential handling changes are introduced by this documentation/skill correction.

The README/INSTALL responsibility split was checked against source commit 5191cf0: README supplies the user request; INSTALL is the executor procedure. The unnecessary install-plugin helper was removed. Only action-tools is bundled for everyday use; source-side update instructions remain separate.
