export const TEMPLATE_REGISTERED_PLUGIN_ID = 'plugin_asdk_app_TEMPLATE_ONLY';
const MCP_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';
const PLUGIN_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const PERSONAL_MARKETPLACE = 'syntoria-weave-personal-marketplace';

function exactKeys(value, expected, description) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== [...expected].sort().join(',')) {
    throw new Error(`${description} must contain exactly ${expected.join(', ')}.`);
  }
}

function validateHttpsUrl(value, name, {allowReserved = false, requirePath = false} = {}) {
  if (typeof value !== 'string' || value !== value.trim() || value.length > 2048) {
    throw new Error(`${name} must be an explicit absolute HTTPS URL.`);
  }
  let url;
  try { url = new URL(value); } catch {
    throw new Error(`${name} must be an explicit absolute HTTPS URL.`);
  }
  const localHost = url.hostname === 'localhost' || url.hostname.endsWith('.localhost')
    || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  const reservedHost = url.hostname.endsWith('.invalid');
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash
    || localHost || (!allowReserved && reservedHost) || (requirePath && url.pathname === '/')
    || (url.href !== value && !(url.pathname === '/' && url.origin === value))) {
    throw new Error(`${name} must be a canonical HTTPS URL without credentials, query, fragment, loopback, or reserved example host.`);
  }
  return value;
}

export function validateRegisteredPluginId(value, {template = false} = {}) {
  if (template && value === TEMPLATE_REGISTERED_PLUGIN_ID) return value;
  if (typeof value !== 'string' || value !== value.trim() || value.length > 256
    || !/^plugin_asdk_app[A-Za-z0-9_-]{1,240}$/.test(value)
    || value === TEMPLATE_REGISTERED_PLUGIN_ID) {
    throw new Error('The exact host-issued registered ChatGPT app ID is required (plugin_asdk_app…).');
  }
  return value;
}

export function validateCloudPluginSettings(input, {template = false} = {}) {
  exactKeys(input, ['issuer', 'resourceEndpoint', 'registeredPluginId'], 'Personal plugin settings');
  return Object.freeze({
    issuer: validateHttpsUrl(input.issuer, 'Authorization server base', {allowReserved: template}),
    resourceEndpoint: validateHttpsUrl(input.resourceEndpoint, 'Remote MCP endpoint', {allowReserved: template, requirePath: true}),
    registeredPluginId: validateRegisteredPluginId(input.registeredPluginId, {template}),
  });
}

export function validateCloudPluginManifest(plugin) {
  if (!plugin || typeof plugin !== 'object' || Array.isArray(plugin)
    || plugin.$schema !== PLUGIN_SCHEMA || plugin.name !== 'syntoria-weave'
    || typeof plugin.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(plugin.version)
    || plugin.extensions?.['com.openai']?.apps !== './.app.json'
    || plugin.extensions?.['com.openai']?.interface?.displayName !== 'Syntoria Weave'
    || typeof plugin.extensions['com.openai'] !== 'object'
    || Object.hasOwn(plugin.extensions['com.openai'], 'requires_local_executor')) {
    throw new Error('The plugin manifest must retain the Syntoria Weave identity and require its registered app dependency.');
  }
  return plugin;
}

export function validateCloudMcpManifest(mcp) {
  if (!mcp || typeof mcp !== 'object' || Array.isArray(mcp) || mcp.$schema !== MCP_SCHEMA) {
    throw new Error('The MCP manifest is missing the Agent Plugins MCP schema.');
  }
  exactKeys(mcp, ['$schema', 'mcpServers'], 'MCP manifest');
  exactKeys(mcp.mcpServers, [], 'MCP servers');
  return mcp;
}

export function validateRegisteredAppManifest(app, {template = false} = {}) {
  exactKeys(app, ['apps'], 'Registered app manifest');
  exactKeys(app.apps, ['actions'], 'Registered app dependencies');
  exactKeys(app.apps.actions, ['id', 'required'], 'The actions app dependency');
  if (app.apps.actions.required !== true) throw new Error('The registered actions app dependency must be required.');
  validateRegisteredPluginId(app.apps.actions.id, {template});
  return app;
}

export function createRegisteredAppManifest(registeredPluginId) {
  const app = {apps: {actions: {id: registeredPluginId, required: true}}};
  return validateRegisteredAppManifest(app, {template: registeredPluginId === TEMPLATE_REGISTERED_PLUGIN_ID});
}

export function createPersonalMarketplaceManifest({installable}) {
  const manifest = {
    name: PERSONAL_MARKETPLACE,
    interface: {displayName: 'Syntoria Weave'},
    plugins: installable ? [{
      name: 'syntoria-weave',
      source: {source: 'local', path: './syntoria-weave'},
      policy: {installation: 'AVAILABLE', authentication: 'ON_INSTALL'},
      category: 'Productivity',
    }] : [],
  };
  return validatePersonalMarketplaceManifest(manifest, {installable});
}

export function validatePersonalMarketplaceManifest(manifest, {installable}) {
  exactKeys(manifest, ['name', 'interface', 'plugins'], 'Personal marketplace manifest');
  if (manifest.name !== PERSONAL_MARKETPLACE || manifest.interface?.displayName !== 'Syntoria Weave'
    || !Array.isArray(manifest.plugins)) {
    throw new Error('The private marketplace must retain its Syntoria Weave identity.');
  }
  if (!installable && manifest.plugins.length !== 0) {
    throw new Error('A template-only artifact cannot list an installable plugin.');
  }
  if (installable) {
    if (manifest.plugins.length !== 1) throw new Error('The private marketplace must list exactly one personal plugin.');
    const [plugin] = manifest.plugins;
    if (plugin.name !== 'syntoria-weave' || plugin.source?.source !== 'local'
      || plugin.source.path !== './syntoria-weave'
      || plugin.policy?.installation !== 'AVAILABLE'
      || plugin.policy?.authentication !== 'ON_INSTALL'
      || plugin.category !== 'Productivity') {
      throw new Error('The private marketplace entry must resolve the packaged plugin and require host authentication.');
    }
  }
  return manifest;
}

export function renderPersonalPluginSettings(input) {
  return validateCloudPluginSettings(input);
}
