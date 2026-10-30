import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchMcp} from '../../lib/mcp/dispatcher.ts';
import {errorCause,observeReply,observeRequest} from '../../lib/mcp/protocol.ts';
import {ActionError} from '../../lib/domain/core.ts';

const V = '2026-07-28';
const meta = {'io.modelcontextprotocol/protocolVersion': V, 'io.modelcontextprotocol/clientInfo': {name: 'ExampleClient', version: '1.0.0'}, 'io.modelcontextprotocol/clientCapabilities': {}};
const subscriptions = {set: async () => assert.fail('modern requests never store subscriptions')};
function modern(method, params = {}, headers = {}, {invoke = async () => ({}), subscribe = subscriptions, id = 7} = {}) {
  return dispatchMcp({jsonrpc: '2.0', id, method, params: {_meta: meta, ...params}}, invoke, true, {headers: {protocolVersion: V, method, ...headers}, subscriptions: subscribe ?? undefined});
}
const errorOf = reply => [reply.status, reply.body.error.code];

test('server/discover advertises both protocol eras, resource notifications and the shared instructions', async () => {
  const reply = await modern('server/discover');
  assert.equal(reply.status, 200);
  const result = reply.body.result;
  assert.equal(reply.body.id, 7);
  assert.equal(result.resultType, 'complete');
  assert.deepEqual(result.supportedVersions, ['2026-07-28', '2025-03-26', '2025-06-18', '2025-11-25']);
  assert.deepEqual(result.capabilities, {tools: {}, resources: {subscribe: true}});
  assert.deepEqual(result._meta['io.modelcontextprotocol/serverInfo'], {name: 'action-tools', version: '0.3.0'});
  assert.deepEqual([result.ttlMs, result.cacheScope], [0, 'private']);
  const legacy = await dispatchMcp({jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-11-25'}}, async () => ({}), true);
  assert.equal(result.instructions, legacy.body.result.instructions);
  assert.deepEqual((await modern('server/discover', {}, {}, {subscribe: null})).body.result.capabilities, {tools: {}, resources: {}});
});

test('modern lists and reads mirror the legacy content with complete cacheable results', async () => {
  const legacy = method => dispatchMcp({jsonrpc: '2.0', id: 1, method, params: {}}, async () => ({}), true);
  const tools = (await modern('tools/list')).body.result;
  assert.deepEqual(tools.tools, (await legacy('tools/list')).body.result.tools);
  assert.deepEqual([tools.resultType, tools.ttlMs, tools.cacheScope], ['complete', 0, 'private']);
  assert.equal((await legacy('tools/list')).body.result.resultType, undefined);
  const resources = (await modern('resources/list')).body.result;
  assert.deepEqual(resources.resources.map(resource => resource.uri), (await legacy('resources/list')).body.result.resources.map(resource => resource.uri));
  assert.deepEqual((await modern('resources/templates/list')).body.result.resourceTemplates, []);
  const read = await modern('resources/read', {uri: 'action-state://current'}, {name: 'action-state://current'}, {invoke: async name => ({read: name})});
  assert.deepEqual(JSON.parse(read.body.result.contents[0].text), {read: 'list_actions'});
  assert.equal(read.body.result.resultType, 'complete');
  const missing = await modern('resources/read', {uri: 'action-state://unknown'}, {name: 'action-state://unknown'});
  assert.deepEqual(errorOf(missing), [200, -32602]);
  assert.deepEqual(missing.body.error.data, {uri: 'action-state://unknown'});
});

test('modern tool calls require the matching Mcp-Name header and keep tool errors inside the result', async () => {
  const calls = [];
  const invoke = async (name, args) => { calls.push([name, args]); return {ok: true}; };
  const called = await modern('tools/call', {name: 'list_actions', arguments: {a: 1}}, {name: 'list_actions'}, {invoke});
  assert.equal(called.status, 200);
  assert.deepEqual(called.body.result.structuredContent, {ok: true});
  assert.equal(called.body.result.resultType, 'complete');
  assert.deepEqual(calls, [['list_actions', {a: 1}]]);
  const encoded = await modern('tools/call', {name: 'list_actions'}, {name: '=?base64?' + Buffer.from('list_actions').toString('base64') + '?='}, {invoke});
  assert.equal(encoded.status, 200);
  for (const name of [undefined, 'apply_change', null, '=?base64?not-base64?='])
    assert.deepEqual(errorOf(await modern('tools/call', {name: 'list_actions'}, {name}, {invoke})), [400, -32020]);
  assert.equal(calls.length, 2, 'rejected headers never reach the tool');
  assert.deepEqual(errorOf(await modern('tools/call', {}, {name: 'list_actions'})), [400, -32602]);
  const domain = await modern('tools/call', {name: 'apply_change'}, {name: 'apply_change'}, {invoke: async () => { throw new ActionError('conflict', 'Revision changed.', 409); }});
  assert.deepEqual([domain.status, domain.body.result.isError, domain.body.result.structuredContent.error.code, domain.cause], [200, true, 'conflict', undefined]);
  const unexpected = await modern('tools/call', {name: 'apply_change'}, {name: 'apply_change'}, {invoke: async () => { throw Object.assign(new Error('relation secret_table does not exist'), {code: '42P01'}); }});
  assert.equal(unexpected.body.result.structuredContent.error.code, 'outcome_unknown');
  assert.equal(unexpected.cause, 'Error 42P01');
});

test('modern requests reject mismatched or missing transport metadata with modern error codes', async () => {
  const reject = async (body, headers) => errorOf(await dispatchMcp(body, async () => ({}), true, {headers}));
  const request = (method, extra = {}) => ({jsonrpc: '2.0', id: 1, method, params: {_meta: {...meta, ...extra}}});
  assert.deepEqual(await reject(request('tools/list'), {method: 'tools/list'}), [400, -32020], 'header required with modern _meta');
  assert.deepEqual(await reject(request('tools/list'), {protocolVersion: '2025-11-25', method: 'tools/list'}), [400, -32020]);
  assert.deepEqual(await reject({jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}}, {protocolVersion: V, method: 'tools/list'}), [400, -32020], '_meta version required with a modern header');
  assert.deepEqual(await reject(request('tools/list'), {protocolVersion: V, method: 'resources/list'}), [400, -32020]);
  assert.deepEqual(await reject(request('tools/list'), {protocolVersion: V, method: null}), [400, -32020]);
  assert.deepEqual(await reject(request('tools/list'), {protocolVersion: null, method: 'tools/list'}), [400, -32020]);
  assert.deepEqual(await reject(request('tools/list', {'io.modelcontextprotocol/clientCapabilities': undefined}), {protocolVersion: V, method: 'tools/list'}), [400, -32602]);
  assert.deepEqual(errorOf(await modern('tools/list', {}, {}, {id: null})), [400, -32600]);
  for (const method of ['initialize', 'ping', 'resources/subscribe', 'prompts/list'])
    assert.deepEqual(errorOf(await modern(method)), [404, -32601], method);
  assert.equal((await dispatchMcp({jsonrpc: '2.0', method: 'notifications/initialized', params: {}}, async () => ({}), true, {headers: {protocolVersion: V}})).status, 202);
});

test('unsupported versions name the supported list for either era', async () => {
  for (const params of [{_meta: {...meta, 'io.modelcontextprotocol/protocolVersion': '2027-01-01'}}, {}]) {
    const reply = await dispatchMcp({jsonrpc: '2.0', id: 'probe', method: 'server/discover', params}, async () => ({}), true, {headers: {protocolVersion: '2027-01-01', method: 'server/discover'}});
    assert.deepEqual(errorOf(reply), [400, -32022]);
    assert.equal(reply.body.id, 'probe');
    assert.deepEqual(reply.body.error.data, {supported: ['2026-07-28', '2025-03-26', '2025-06-18', '2025-11-25'], requested: '2027-01-01'});
  }
});

test('subscriptions/listen returns the acknowledged resources for the transport without storing them', async () => {
  const listen = notifications => modern('subscriptions/listen', {notifications});
  const accepted = await listen({toolsListChanged: true, resourceSubscriptions: ['action-state://assigned', 'action-state://unknown', 'action-state://current', 'action-state://current']});
  assert.deepEqual([accepted.status, accepted.body, accepted.listen], [200, null, {id: 7, resources: ['action-state://current', 'action-state://assigned']}]);
  assert.deepEqual((await listen({promptsListChanged: true})).listen, {id: 7, resources: []});
  assert.deepEqual(errorOf(await listen(undefined)), [400, -32602]);
  assert.deepEqual(errorOf(await listen([])), [400, -32602]);
  assert.deepEqual(errorOf(await modern('subscriptions/listen', {notifications: {}}, {}, {subscribe: null})), [404, -32601]);
});

test('legacy requests keep the initialize-based contract beside the modern era', async () => {
  const legacy = (method, params = {}, headers = {}) => dispatchMcp({jsonrpc: '2.0', id: 1, method, params}, async () => ({}), true, {headers, subscriptions: {set: async () => {}}});
  const initialized = await legacy('initialize', {protocolVersion: '2025-06-18'}, {protocolVersion: '2025-06-18'});
  assert.equal(initialized.body.result.protocolVersion, '2025-06-18');
  assert.equal(initialized.body.result.resultType, undefined);
  assert.equal((await legacy('ping', {}, {protocolVersion: '2025-11-25'})).status, 200);
  assert.deepEqual((await legacy('resources/subscribe', {uri: 'action-state://current'})).body.result, {});
  assert.deepEqual(errorOf(await legacy('server/discover')), [200, -32601]);
  assert.deepEqual(errorOf(await legacy('subscriptions/listen', {notifications: {}})), [200, -32601]);
});

test('request observations keep bounded protocol identity and never arguments or content', () => {
  const observed = observeRequest({jsonrpc: '2.0', id: 1, method: 'tools/call', params: {name: 'apply_change', arguments: {payload: {title: 'Private title'}}, _meta: {...meta, 'io.modelcontextprotocol/clientCapabilities': {extensions: {'io.modelcontextprotocol/ui': {}}}}}}, {protocolVersion: V, method: 'tools/call', name: 'apply_change'});
  assert.deepEqual(observed, {mcp_version: V, mcp_method: 'tools/call', mcp_tool: 'apply_change', mcp_client: 'ExampleClient 1.0.0', mcp_extensions: ['io.modelcontextprotocol/ui']});
  assert.deepEqual(observeRequest({method: 'initialize', params: {protocolVersion: '2025-11-25', clientInfo: {name: 'openai-mcp', version: '1.0.0'}}}, {}), {mcp_version: '2025-11-25', mcp_method: 'initialize', mcp_client: 'openai-mcp 1.0.0'});
  const hostile = observeRequest({method: 'tools/call', params: {name: 'Drop table', _meta: {'io.modelcontextprotocol/clientInfo': {name: 'person@example.invalid', version: 'line\nbreak'}}}}, {protocolVersion: 'future version'});
  assert.deepEqual(hostile, {mcp_version: 'invalid', mcp_method: 'tools/call', mcp_tool: 'invalid', mcp_client: 'invalid invalid'});
  assert.deepEqual(observeRequest(undefined, {protocolVersion: null}), {mcp_version: 'ambiguous'});
  assert.deepEqual(observeReply({status: 400, body: {error: {code: -32020}}}), {mcp_error: -32020});
  assert.deepEqual(observeReply({status: 200, body: {result: {isError: true, structuredContent: {error: {code: 'conflict', message: 'Private title'}}}}}), {mcp_error: 'conflict'});
  assert.deepEqual(observeReply({status: 200, body: {result: {structuredContent: {}}}}), {});
  assert.equal(errorCause(new ActionError('unauthenticated', 'Token person@example.invalid expired.', 401)), 'unauthenticated');
  assert.equal(errorCause(Object.assign(new TypeError('person@example.invalid'), {code: 'ECONNRESET'})), 'TypeError ECONNRESET');
  assert.equal(errorCause(Object.assign(new Error('x'), {name: 'bad name\n', code: 'lower case'})), 'Error');
  assert.equal(errorCause('person@example.invalid'), 'string');
});
