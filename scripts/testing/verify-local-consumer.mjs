import assert from 'node:assert/strict';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {postgresFixture} from '../../tests/helpers/postgres.mjs';
import {createIdentityStore} from '../../lib/adapters/postgres/identity-store.ts';
import {createPostgresActionStore, cursorScope} from '../../lib/adapters/postgres/action-store.ts';
import {actionCall} from '../../lib/application/action-service.ts';
import {createAuthentication, createGateVerification} from '../../lib/server/node/authentication.ts';
import {createServer} from '../../lib/server/node/server.ts';
import {gateFixture} from '../../tests/helpers/gate.mjs';
import {validateLocalConfiguration} from '../../lib/mcp/local/config.mjs';
import {LocalMcpServer} from '../../lib/mcp/local/server.mjs';

const origin = 'https://api.example.com';
const resource = `${origin}/mcp`;
const config = {
  origin,
  issuer: '',
  resource,
  browserClientId: 'web',
  spaOrigins: ['https://app.example.com'],
  sharedCookieDomain: 'example.com',
  gateClientId: 'resource',
  gateClientSecret: 'synthetic-secret',
  databaseUrl: '',
  cursorEpoch: randomUUID(),
  writeMode: 'enabled',
  localDatabase: true,
};

function requestHttp(port, path, {method = 'GET', headers = {}, body} = {}) {
  const payload = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request({host: '127.0.0.1', port, path, method, agent: false, headers: {
      host: 'api.example.com',
      ...(payload === undefined ? {} : {'content-type': 'application/json', 'content-length': Buffer.byteLength(payload)}),
      ...headers,
    }}, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode ?? 0,
        headers: response.headers,
        bytes: Buffer.concat(chunks),
        text: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.on('error', reject);
    request.setTimeout(10_000, () => request.destroy(new Error('Local consumer HTTP request timed out.')));
    request.end(payload);
  });
}

async function call(server, id, name, args = {}) {
  const response = await server.handle({jsonrpc: '2.0', id, method: 'tools/call', params: {name, arguments: args}});
  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, id);
  return response;
}

function authorizeWithIssuer(gate, authorizationUrl, options) {
  const callback = new URL(gate.authorize(authorizationUrl, options));
  callback.searchParams.set('iss', gate.issuer);
  return callback;
}

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const value = await predicate();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail(message);
}

const root = await mkdtemp(join(tmpdir(), 'action-tools-local-consumer-'));
let database;
let gate;
let api;
const localServers = [];
  let registrationCount = 0;

try {
  database = await postgresFixture();
  gate = await gateFixture();
  config.issuer = gate.issuer;
  config.databaseUrl = database.url;
  const verification = createGateVerification(config, {fetch: gate.fetch});
  const identity = createIdentityStore(database.pool);
  const authentication = createAuthentication(config, identity, verification);

  await database.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3)', [config.issuer, 'person', 'user-one']);
  await database.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3)', [config.issuer, 'other-person', 'user-two']);

  api = createServer({
    config,
    authentication,
    log: () => {},
    invoke: (principal, name, args, signal) => actionCall({
      store: createPostgresActionStore(database.pool, principal, {revalidate: client => authentication.revalidate(principal, client), signal}),
      clock: () => new Date().toISOString(),
      newId: randomUUID,
      changeCursorScope: async () => cursorScope(principal.user, config.cursorEpoch),
    }, name, args),
  });
  const address = await api.listen({host: '127.0.0.1', port: 0});
  const port = Number(new URL(address).port);

  const localFetcher = async (input, options = {}) => {
    const target = new URL(input);
    if (target.origin === new URL(config.issuer).origin) {
      if (target.pathname === '/.well-known/openid-configuration' && (options.method ?? 'GET') === 'GET') {
        const response = await gate.fetch(target, options);
        const metadata = await response.json();
        return new Response(JSON.stringify({...metadata, registration_endpoint: `${gate.issuer}/register`, authorization_response_iss_parameter_supported: true}), {status: response.status, headers: {'content-type': 'application/json'}});
      }
      if (target.pathname === '/register' && options.method === 'POST') {
        registrationCount++;
        const request = JSON.parse(options.body);
        return new Response(JSON.stringify({
          client_id: `dynamic-local-client-${registrationCount}`,
          client_id_issued_at: Math.floor(Date.now() / 1000),
          application_type: request.application_type,
          redirect_uris: request.redirect_uris,
          response_types: request.response_types,
          grant_types: request.grant_types,
          scope: request.scope,
          token_endpoint_auth_method: request.token_endpoint_auth_method,
        }), {status: 201, headers: {'content-type': 'application/json'}});
      }
      return gate.fetch(target, options);
    }
    assert.equal(target.origin, origin, 'local MCP may only reach the configured issuer and action resource');
    const response = await requestHttp(port, target.pathname + target.search, {
      method: options.method ?? 'GET',
      headers: Object.fromEntries(new Headers(options.headers ?? {})),
      body: options.body,
    });
    return new Response(response.bytes, {status: response.status, headers: {'content-type': response.headers['content-type'] ?? 'application/json'}});
  };

  const makeLocalServer = async (subject, dataDirectory) => {
    const installRoot = join(root, `install-${subject}`);
    await mkdir(installRoot, {recursive: true, mode: 0o700});
    const rendered = validateLocalConfiguration({issuer: gate.issuer, resourceEndpoint: resource, dataDirectory});
    const configPath = join(installRoot, 'config.json');
    await writeFile(configPath, `${JSON.stringify(rendered)}\n`, {mode: 0o600});
    const local = new LocalMcpServer({configPath, pluginRoot: installRoot, fetcher: localFetcher});
    localServers.push(local);
    return local;
  };

  const firstDataDirectory = join(root, 'user-one-private');
  const first = await makeLocalServer('person', firstDataDirectory);
  const initialization = await first.handle({jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-11-25'}});
  assert.equal(initialization.result.serverInfo.name, 'action-tools-local');
  const listed = await first.handle({jsonrpc: '2.0', id: 2, method: 'tools/list'});
  assert(listed.result.tools.some(tool => tool.name === 'connect_action_service'));
  assert(listed.result.tools.some(tool => tool.name === 'apply_change'));

  const connection = await call(first, 3, 'connect_action_service');
  assert.equal(connection.result.structuredContent.authorizationUrl !== undefined, true);
  const authorizationUrl = connection.result.structuredContent.authorizationUrl;
  const authorization = new URL(authorizationUrl);
  assert.equal(authorization.searchParams.get('client_id'), 'dynamic-local-client-1');
  assert.equal(authorization.searchParams.get('redirect_uri'), 'http://127.0.0.1:55437/callback');
  assert.equal(authorization.searchParams.get('resource'), resource);
  const callback = authorizeWithIssuer(gate, authorizationUrl, {subject: 'person'});
  const callbackReply = await requestHttp(callback.port, callback.pathname + callback.search, {headers: {host: '127.0.0.1:55437'}});
  assert.equal(callbackReply.status, 200);
  assert(!callbackReply.text.includes(callback.searchParams.get('code')));
  await waitFor(async () => (await call(first, 4, 'get_connection_status')).result.structuredContent.connected, 'first user OAuth callback did not persist authorization');

  const metadata = await requestHttp(port, '/.well-known/oauth-protected-resource/mcp');
  assert.equal(metadata.status, 200);
  assert.equal(JSON.parse(metadata.text).resource, resource);

  const initial = await call(first, 5, 'list_actions');
  assert.equal(initial.result.structuredContent.revision, 0);
  const operationId = randomUUID();
  const writeArguments = {
    schemaVersion: 2,
    operationId,
    expectedRevision: 0,
    kind: 'add',
    payload: {title: 'Local MCP forwarded action', notes: 'Saved through real Node HTTP/MCP and PostgreSQL.'},
  };
  const write = await call(first, 6, 'apply_change', writeArguments);
  assert.equal(write.result.structuredContent.revision, 1);
  const replay = await call(first, 7, 'apply_change', writeArguments);
  assert.equal(replay.result.structuredContent.revision, 1);
  assert.equal(replay.result.structuredContent.result.operationId, operationId);
  assert.equal(replay.result.structuredContent.actions.length, 1);
  const receipt = await call(first, 8, 'operation_status', {operationId});
  assert.equal(receipt.result.structuredContent.status, 'applied');

  const undoId = randomUUID();
  const undo = await call(first, 9, 'undo_change', {schemaVersion: 2, operationId: undoId, expectedRevision: 1, undoOf: operationId});
  assert.equal(undo.result.structuredContent.revision, 2);
  const afterUndo = await call(first, 10, 'list_actions');
  assert.equal(afterUndo.result.structuredContent.revision, 2);
  assert.equal(afterUndo.result.structuredContent.actions.length, 1);
  assert.equal(afterUndo.result.structuredContent.actions[0].status, 'dropped');
  assert.equal((await database.admin.query('SELECT count(*)::int AS count FROM state.actions WHERE user_id=$1 AND status<>$2', ['user-one', 'dropped'])).rows[0].count, 0);

  await first.stop();
  const restarted = await makeLocalServer('person', firstDataDirectory);
  assert.equal((await call(restarted, 11, 'get_connection_status')).result.structuredContent.connected, true);
  assert.equal((await call(restarted, 12, 'list_actions')).result.structuredContent.revision, 2);
  assert.equal(registrationCount, 1, 'registration must survive a process restart');
  await restarted.stop();

  const second = await makeLocalServer('other-person', join(root, 'user-two-private'));
  const secondConnection = await call(second, 13, 'connect_action_service');
  const secondAuthorizationUrl = secondConnection.result.structuredContent.authorizationUrl;
  assert.equal(new URL(secondAuthorizationUrl).searchParams.get('client_id'), 'dynamic-local-client-2');
  const secondCallback = authorizeWithIssuer(gate, secondAuthorizationUrl, {subject: 'other-person'});
  assert.equal(secondCallback.searchParams.get('state'), new URL(secondAuthorizationUrl).searchParams.get('state'));
  const secondCallbackReply = await requestHttp(secondCallback.port, secondCallback.pathname + secondCallback.search, {headers: {host: '127.0.0.1:55437'}});
  assert.equal(secondCallbackReply.status, 200, secondCallbackReply.text);
  await waitFor(async () => (await call(second, 14, 'get_connection_status')).result.structuredContent.connected, 'second user OAuth callback did not persist authorization');
  const secondList = await call(second, 15, 'list_actions');
  assert.equal(secondList.result.structuredContent.revision, 0);
  assert.deepEqual(secondList.result.structuredContent.actions, []);
  assert.equal((await database.admin.query('SELECT count(*)::int AS count FROM state.actions WHERE user_id=$1', ['user-two'])).rows[0].count, 0);

  const notification = await first.handle({jsonrpc: '2.0', method: 'notifications/initialized'});
  assert.equal(notification, null);
  process.stdout.write('passed: real Node HTTP/MCP and PostgreSQL forwarding, exact OAuth issuer/resource, write/replay/Undo, and user isolation\n');
} finally {
  for (const local of localServers) await local.stop().catch(() => {});
  await api?.close().catch(() => {});
  await gate?.close().catch(() => {});
  await database?.close().catch(() => {});
  await rm(root, {recursive: true, force: true});
}
