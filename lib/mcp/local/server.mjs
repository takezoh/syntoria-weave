import {createInterface} from 'node:readline';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {privateDefinitions, privateResources} from '../tool-definitions.ts';
import {widgetHtml, UI_URI} from '../../widget.ts';
import {configurationBinding, loadLocalConfiguration, resolvePrivateDataDirectory} from './config.mjs';
import {LocalMcpError} from './errors.mjs';
import {LocalOAuthClient} from './oauth.mjs';
import {forwardBusinessCall} from './remote.mjs';
import {AuthorizationStateStore} from './state-store.mjs';

const PROTOCOL_VERSIONS = ['2025-03-26', '2025-06-18', '2025-11-25'];
const LOCAL_TOOL_DEFINITIONS = [
  {
    name: 'connect_action_service',
    title: 'Connect action service',
    description: 'Start a short-lived local OAuth authorization flow. Open the returned URL and approve the public action-tools client. The callback listens only on 127.0.0.1:55437.',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false},
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true},
  },
  {
    name: 'get_connection_status',
    title: 'Get connection status',
    description: 'Show whether local authorization credentials are stored. This does not probe the remote service or expose credentials.',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false},
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false},
  },
  {
    name: 'disconnect_action_service',
    title: 'Disconnect action service',
    description: 'Clear locally stored authorization credentials and cancel a pending callback.',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false},
    annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false},
  },
];
const SHARED_TOOLS = privateDefinitions;
const BUSINESS_TOOLS = SHARED_TOOLS.filter(tool => tool.name !== 'open_actions');
const TOOL_BY_NAME = new Map(BUSINESS_TOOLS.map(tool => [tool.name, tool]));
const UI_RESOURCE = privateResources.find(resource => resource.uri === UI_URI);

function emptyArguments(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
}

function toolResult(value) {
  return {content: [{type: 'text', text: JSON.stringify(value)}], structuredContent: value};
}

function errorResult(error) {
  const code = error instanceof LocalMcpError ? error.code : 'authorization_unavailable';
  const message = error instanceof LocalMcpError ? error.message : 'The local action service could not complete this request.';
  const value = {error: {code, message}};
  return {isError: true, content: [{type: 'text', text: message}], structuredContent: value};
}

export class LocalMcpServer {
  constructor({configPath, pluginRoot, env = {}, fetcher = globalThis.fetch} = {}) {
    this.configPath = configPath;
    this.pluginRoot = pluginRoot;
    this.env = env;
    this.fetcher = fetcher;
    this.connectionPromise = undefined;
  }

  async #connection() {
    if (!this.connectionPromise) {
      this.connectionPromise = (async () => {
        const config = await loadLocalConfiguration(this.configPath);
        const dataDirectory = resolvePrivateDataDirectory(config, this.env, this.pluginRoot);
        const store = new AuthorizationStateStore(dataDirectory, configurationBinding(config));
        const oauth = new LocalOAuthClient({config, store, fetcher: this.fetcher});
        return {config, store, oauth};
      })();
    }
    try { return await this.connectionPromise; }
    catch (error) { this.connectionPromise = undefined; throw error; }
  }

  async stop() {
    if (!this.connectionPromise) return;
    const connection = await this.connectionPromise.catch(() => null);
    await connection?.oauth.close();
  }

  async #lifecycle(name) {
    if (name === 'get_connection_status') {
      try { return toolResult({configured: true, ...(await (await this.#connection()).oauth.status())}); }
      catch (error) {
        if (error instanceof LocalMcpError && ['configuration_required', 'configuration_unavailable', 'private_data_path_required'].includes(error.code)) {
          return toolResult({configured: false, connected: false, credentialState: 'unavailable', configurationError: {code: error.code, message: error.message}});
        }
        return errorResult(error);
      }
    }
    if (name === 'connect_action_service') {
      try { return toolResult(await (await this.#connection()).oauth.connect()); }
      catch (error) { return errorResult(error); }
    }
    try { return toolResult(await (await this.#connection()).oauth.disconnect()); }
    catch (error) { return errorResult(error); }
  }

  async #toolCall(params) {
    if (!params || typeof params !== 'object' || Array.isArray(params) || typeof params.name !== 'string') {
      return {jsonRpcError: {code: -32602, message: 'Tool name and arguments are required.'}};
    }
    const name = params.name;
    if ([...LOCAL_TOOL_DEFINITIONS.map(tool => tool.name), 'open_actions'].includes(name)) {
      if (!emptyArguments(params.arguments ?? {})) return {jsonRpcError: {code: -32602, message: `${name} takes an empty object.`}};
      if (name === 'open_actions') return {result: toolResult({opened: true, resourceUri: UI_URI})};
      return {result: await this.#lifecycle(name)};
    }
    const tool = TOOL_BY_NAME.get(name);
    if (!tool) return {jsonRpcError: {code: -32602, message: 'Unknown action-tools tool.'}};
    const args = params.arguments ?? {};
    if (!args || typeof args !== 'object' || Array.isArray(args)) return {jsonRpcError: {code: -32602, message: 'Tool arguments must be a JSON object.'}};
    try {
      const {config, oauth} = await this.#connection();
      const wire = await forwardBusinessCall({config, oauth, definitions: BUSINESS_TOOLS, fetcher: this.fetcher}, name, args);
      if (wire.error !== undefined) return {jsonRpcError: wire.error};
      return {result: wire.result};
    } catch (error) { return {result: errorResult(error)}; }
  }

  async handle(input) {
    let request;
    try { request = typeof input === 'string' ? JSON.parse(input) : input; }
    catch { return {jsonrpc: '2.0', id: null, error: {code: -32700, message: 'Parse error'}}; }
    if (!request || typeof request !== 'object' || Array.isArray(request) || request.jsonrpc !== '2.0' || typeof request.method !== 'string' || (request.id !== undefined && request.id !== null && !['string', 'number'].includes(typeof request.id)) || (typeof request.id === 'number' && !Number.isFinite(request.id))) {
      return {jsonrpc: '2.0', id: request && typeof request === 'object' && !Array.isArray(request) ? request.id ?? null : null, error: {code: -32600, message: 'Invalid request'}};
    }
    const hasId = Object.hasOwn(request, 'id');
    const id = request.id ?? null;
    if (request.method.startsWith('notifications/')) {
      if (hasId) return {jsonrpc: '2.0', id, error: {code: -32600, message: 'Notifications must not include an id.'}};
      return null;
    }
    if (!hasId || request.id === null) return {jsonrpc: '2.0', id: null, error: {code: -32600, message: 'Requests must include a non-null id.'}};
    let result;
    switch (request.method) {
      case 'initialize': {
        const requested = request.params?.protocolVersion;
        result = {protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : '2025-11-25', capabilities: {tools: {}, resources: {}}, serverInfo: {name: 'action-tools-local', version: '1.0.0'}, instructions: 'Connect the action service with connect_action_service. Business tools use the same remote action service as the shared UI.'};
        break;
      }
      case 'ping': result = {}; break;
      case 'tools/list': result = {tools: [...LOCAL_TOOL_DEFINITIONS, ...SHARED_TOOLS]}; break;
      case 'resources/list': result = {resources: UI_RESOURCE ? [UI_RESOURCE] : []}; break;
      case 'resources/templates/list': result = {resourceTemplates: []}; break;
      case 'resources/read':
        if (request.params?.uri !== UI_URI) return {jsonrpc: '2.0', id, error: {code: -32602, message: 'Unknown local resource.'}};
        result = {contents: [{uri: UI_URI, mimeType: 'text/html;profile=mcp-app', text: widgetHtml, _meta: {ui: {prefersBorder: true, csp: {connectDomains: [], resourceDomains: []}}}}]};
        break;
      case 'tools/call': {
        const called = await this.#toolCall(request.params);
        if (called.jsonRpcError) return {jsonrpc: '2.0', id, error: called.jsonRpcError};
        result = called.result;
        break;
      }
      default: return {jsonrpc: '2.0', id, error: {code: -32601, message: 'Method not found'}};
    }
    return {jsonrpc: '2.0', id, result};
  }
}

export async function runStdio({input = process.stdin, output = process.stdout, configPath, pluginRoot = dirname(fileURLToPath(import.meta.url)), env = {}} = {}) {
  const server = new LocalMcpServer({configPath, pluginRoot, env});
  const lines = createInterface({input, crlfDelay: Infinity});
  let stopping;
  const stop = () => { lines.close(); stopping ??= server.stop(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    for await (const line of lines) {
      const response = await server.handle(line);
      if (response !== null) output.write(`${JSON.stringify(response)}\n`);
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await (stopping ?? server.stop());
  }
}
