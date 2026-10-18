import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer, get as httpGet} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp, lstat, readdir, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {AuthorizationStateStore} from '../../lib/mcp/local/state-store.mjs';
import {CALLBACK_URL, configurationBinding, validateLocalConfiguration} from '../../lib/mcp/local/config.mjs';
import {LocalOAuthClient} from '../../lib/mcp/local/oauth.mjs';
import {forwardBusinessCall} from '../../lib/mcp/local/remote.mjs';
import {gateFixture} from '../helpers/gate.mjs';

const resourceEndpoint = 'https://api.example.com/mcp';
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function configuration(issuer, dataDirectory) {
  return validateLocalConfiguration({issuer, resourceEndpoint, clientId: 'action-tools-client', dataDirectory});
}

async function fixture(t, {fetcher} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'action-tools-local-test-'));
  const gate = await gateFixture();
  t.after(async () => { await gate.close(); await rm(directory, {recursive: true, force: true}); });
  const config = configuration(gate.issuer, join(directory, 'private'));
  const baseFetcher = fetcher ?? (async (url, options) => {
    const target = new URL(url);
    if (target.origin === new URL(resourceEndpoint).origin && target.pathname === '/.well-known/oauth-protected-resource/mcp') {
      return new Response(JSON.stringify({resource: resourceEndpoint, authorization_servers: [gate.issuer]}), {status: 200, headers: {'content-type': 'application/json'}});
    }
    return gate.fetch(url, options);
  });
  const store = new AuthorizationStateStore(config.dataDirectory, configurationBinding(config));
  const oauth = new LocalOAuthClient({config, store, fetcher: baseFetcher});
  return {directory, gate, config, store, oauth, fetcher: baseFetcher};
}

function callbackRequest(callbackUrl) {
  const target = new URL(callbackUrl);
  return new Promise((resolve, reject) => {
    const pending = httpGet({host: '127.0.0.1', port: Number(target.port), path: target.pathname + target.search, agent: false}, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({status: response.statusCode, body: Buffer.concat(chunks).toString('utf8')}));
    });
    pending.on('error', reject);
  });
}

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const result = await predicate();
    if (result) return result;
    await delay(10);
  }
  assert.fail(message);
}

test('local authorization preserves exact root issuer, uses PKCE, and wrong-state callbacks do not consume the flow', async t => {
  const {gate, config, store, oauth} = await fixture(t);
  assert.equal(config.issuer, gate.issuer);
  assert.equal(new URL(config.issuer).pathname, '/');
  assert.equal(CALLBACK_URL, 'http://127.0.0.1:55437/callback');
  const flow = await oauth.connect();
  const authorize = new URL(flow.authorizationUrl);
  assert.equal(authorize.searchParams.get('client_id'), config.clientId);
  assert.equal(authorize.searchParams.get('redirect_uri'), CALLBACK_URL);
  assert.equal(authorize.searchParams.get('resource'), resourceEndpoint);
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  assert.match(authorize.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43,128}$/);
  assert.equal(authorize.searchParams.get('state').length >= 32, true);
  assert.deepEqual(await oauth.connect(), flow);

  const callback = new URL(gate.authorize(flow.authorizationUrl));
  const wrong = new URL(callback);
  wrong.searchParams.set('state', 'wrong-state');
  const rejected = await callbackRequest(wrong.href);
  assert.equal(rejected.status, 400);
  assert(!rejected.body.includes(callback.searchParams.get('code')));
  assert.equal((await oauth.connect()).authorizationUrl, flow.authorizationUrl);

  const completed = await callbackRequest(callback.href);
  assert.equal(completed.status, 200);
  assert(!completed.body.includes(callback.searchParams.get('code')));
  await waitFor(async () => (await store.inspect()).credentials, 'authorization code exchange did not save credentials');
  const status = await oauth.status();
  assert.deepEqual(status, {connected: true, credentialState: 'stored', serviceAcceptance: 'not_checked'});
  assert(!JSON.stringify(status).includes((await store.inspect()).credentials.accessToken));
  assert.equal((await oauth.connect()).alreadyConnected, true);
  assert.equal(gate.authorizations, 1);

  const saved = await store.inspect();
  await store.updateCredentials(async state => ({...state.credentials, expiresAt: Math.floor(Date.now() / 1000) - 1}));
  const refreshedToken = await oauth.accessToken();
  assert.equal(typeof refreshedToken, 'string');
  assert.equal(gate.refreshes, 1);
  assert.equal((await oauth.status()).serviceAcceptance, 'not_checked');

  const refreshed = await store.inspect();
  gate.revoke(refreshed.credentials.refreshToken);
  await store.updateCredentials(async state => ({...state.credentials, expiresAt: Math.floor(Date.now() / 1000) - 1}));
  await assert.rejects(oauth.accessToken(), error => error.code === 'unauthenticated');
  assert.equal((await store.inspect()).credentials, null);
  await oauth.disconnect();
  assert.equal((await store.inspect()).generation, saved.generation + 2);
});

test('local OAuth rejects redirects at discovery, protected-resource metadata, and token exchange', async t => {
  const {gate, config, store, fetcher: baseFetcher} = await fixture(t);
  const redirect = async () => new Response('', {status: 302, headers: {location: 'https://attacker.invalid/'} });
  const discoveryClient = new LocalOAuthClient({config, store, fetcher: redirect});
  await assert.rejects(discoveryClient.connect(), error => error.code === 'authorization_unavailable');

  let resourceRedirect = true;
  const resourceFetcher = async (url, options) => {
    if (resourceRedirect && new URL(url).pathname.startsWith('/.well-known/oauth-protected-resource')) {
      return new Response('', {status: 302, headers: {location: 'https://attacker.invalid/'} });
    }
    return baseFetcher(url, options);
  };
  const metadataClient = new LocalOAuthClient({config, store, fetcher: resourceFetcher});
  await assert.rejects(metadataClient.connect(), error => error.code === 'authorization_unavailable');
  resourceRedirect = false;

  let tokenRedirect = true;
  const tokenFetcher = async (url, options) => {
    if (tokenRedirect && new URL(url).pathname === '/token') return new Response('', {status: 302, headers: {location: 'https://attacker.invalid/token'} });
    return baseFetcher(url, options);
  };
  const tokenStore = new AuthorizationStateStore(join(config.dataDirectory, 'token-redirect'), configurationBinding(config));
  const tokenClient = new LocalOAuthClient({config, store: tokenStore, fetcher: tokenFetcher});
  const flow = await tokenClient.connect();
  const callback = gate.authorize(flow.authorizationUrl);
  assert.equal((await callbackRequest(callback)).status, 200);
  await delay(50);
  assert.equal((await tokenStore.inspect()).credentials, null);
  assert.equal(gate.authorizations, 0);
});

test('disconnect and process close invalidate in-flight callbacks without clearing saved credentials on shutdown', async t => {
  let tokenStartedResolve;
  let releaseTokenResolve;
  const tokenStarted = new Promise(resolve => { tokenStartedResolve = resolve; });
  const releaseToken = new Promise(resolve => { releaseTokenResolve = resolve; });
  let pauseToken = true;
  const {gate, config, directory, fetcher: baseFetcher} = await fixture(t);
  const store = new AuthorizationStateStore(join(directory, 'race-private'), configurationBinding(config));
  const oauth = new LocalOAuthClient({config, store, fetcher: async (url, options) => {
    if (pauseToken && new URL(url).pathname === '/token' && new URLSearchParams(options.body).get('grant_type') === 'authorization_code') {
      pauseToken = false;
      tokenStartedResolve();
      await releaseToken;
    }
    return baseFetcher(url, options);
  }});
  const flow = await oauth.connect();
  const callback = gate.authorize(flow.authorizationUrl);
  assert.equal((await callbackRequest(callback)).status, 200);
  await tokenStarted;
  await oauth.disconnect();
  releaseTokenResolve();
  await waitFor(async () => (await store.inspect()).generation === 1, 'disconnect generation was not persisted');
  await delay(50);
  assert.equal((await store.inspect()).credentials, null);
  assert.equal(gate.authorizations, 1);
  await oauth.close();

  await store.saveAuthorization({accessToken: 'existing-expired-token', refreshToken: null, expiresAt: 0}, 1);
  let shutdownStartedResolve;
  let allowShutdownTokenResolve;
  const shutdownStarted = new Promise(resolve => { shutdownStartedResolve = resolve; });
  const allowShutdownToken = new Promise(resolve => { allowShutdownTokenResolve = resolve; });
  const shutdownOAuth = new LocalOAuthClient({config, store, fetcher: async (url, options) => {
    if (new URL(url).pathname === '/token' && new URLSearchParams(options.body).get('grant_type') === 'authorization_code') {
      shutdownStartedResolve();
      await allowShutdownToken;
    }
    return baseFetcher(url, options);
  }});
  const shutdownFlow = await shutdownOAuth.connect();
  const shutdownCallback = gate.authorize(shutdownFlow.authorizationUrl);
  assert.equal((await callbackRequest(shutdownCallback)).status, 200);
  await shutdownStarted;
  await shutdownOAuth.close();
  allowShutdownTokenResolve();
  await waitFor(async () => (await store.inspect()).generation === 2, 'process close did not invalidate the pending authorization generation');
  await delay(50);
  assert.deepEqual((await store.inspect()).credentials, {accessToken: 'existing-expired-token', refreshToken: null, expiresAt: 0});
  await shutdownOAuth.close();
});

test('callback port conflict is actionable and private authorization storage is bounded and local', async t => {
  const {config, store, fetcher} = await fixture(t);
  const listener = createServer();
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(55437, '127.0.0.1', resolve); });
  try {
    const oauth = new LocalOAuthClient({config, store, fetcher});
    await assert.rejects(oauth.connect(), error => error.code === 'callback_port_in_use' && /55437/.test(error.message));
  } finally { await new Promise(resolve => listener.close(resolve)); }

  const state = await store.inspect();
  const directoryInfo = await lstat(config.dataDirectory);
  const fileInfo = await lstat(join(config.dataDirectory, 'authorization.sqlite'));
  assert.equal(directoryInfo.mode & 0o777, 0o700);
  assert.equal(fileInfo.mode & 0o777, 0o600);
  assert.deepEqual(state, {version: 1, binding: configurationBinding(config), generation: 0, credentials: null});
  const db = new DatabaseSync(join(config.dataDirectory, 'authorization.sqlite'));
  db.exec('UPDATE authorization_state SET version = 2 WHERE id = 1');
  db.close();
  await assert.rejects(store.inspect(), error => error.code === 'private_state_invalid');

  const parent = await mkdtemp(join(tmpdir(), 'action-tools-symlink-parent-'));
  t.after(() => rm(parent, {recursive: true, force: true}));
  const link = join(parent, 'linked');
  await symlink(config.dataDirectory, link);
  const symlinkStore = new AuthorizationStateStore(link, configurationBinding(config));
  await assert.rejects(symlinkStore.inspect(), error => error.code === 'private_data_path_invalid');
});

test('SQLite transactions serialize same-process and cross-process refreshes in a private directory', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'action-tools-sqlite-race-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const binding = JSON.stringify({issuer: 'https://gate.example.test', resourceEndpoint, clientId: 'action-tools-client', redirectUri: CALLBACK_URL});
  const store = new AuthorizationStateStore(directory, binding);
  await store.saveAuthorization({accessToken: 'expired', refreshToken: 'refresh', expiresAt: 0}, 0);
  const sameProcessStore = new AuthorizationStateStore(directory, binding);
  let sameProcessRefreshes = 0;
  const sameProcessUpdate = async state => {
    if (state.credentials.expiresAt > Math.floor(Date.now() / 1000)) return state.credentials;
    sameProcessRefreshes++;
    await delay(75);
    return {...state.credentials, accessToken: 'same-process-fresh', expiresAt: Math.floor(Date.now() / 1000) + 600};
  };
  await Promise.all([store.updateCredentials(sameProcessUpdate), sameProcessStore.updateCredentials(sameProcessUpdate)]);
  assert.equal(sameProcessRefreshes, 1);
  await store.updateCredentials(async state => ({...state.credentials, accessToken: 'expired-cross-process', expiresAt: 0}));
  let parentRefreshed = false;
  let enteredResolve;
  const entered = new Promise(resolve => { enteredResolve = resolve; });
  const parentRefresh = store.updateCredentials(async state => {
    if (state.credentials.expiresAt > Math.floor(Date.now() / 1000)) return state.credentials;
    parentRefreshed = true;
    enteredResolve();
    await delay(250);
    return {...state.credentials, accessToken: 'fresh-access-token', expiresAt: Math.floor(Date.now() / 1000) + 600};
  });
  await entered;
  const code = `
    const {AuthorizationStateStore}=await import(process.argv[1]);
    const [directory,binding]=process.argv.slice(2);
    const {setTimeout:delay}=await import('node:timers/promises');
    let refreshed=false;
    const store=new AuthorizationStateStore(directory,binding);
    const state=await store.updateCredentials(async current=>{
      if(current.credentials.expiresAt>Math.floor(Date.now()/1000))return current.credentials;
      refreshed=true; await delay(50);
      return {...current.credentials,accessToken:'fresh-access-token',expiresAt:Math.floor(Date.now()/1000)+600};
    });
    process.stdout.write(JSON.stringify({refreshed,accessToken:state.credentials.accessToken}));
  `;
  const moduleUrl = new URL('../../lib/mcp/local/state-store.mjs', import.meta.url).href;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code, moduleUrl, directory, binding], {stdio: ['ignore', 'pipe', 'pipe']});
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const childExit = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (status, signal) => status === 0 && !signal ? resolve() : reject(new Error(stderr || `child exited ${status ?? signal}`)));
  });
  assert.equal((await lstat(directory)).mode & 0o777, 0o700);
  const duringLock = await readdir(directory);
  for (const name of duringLock.filter(value => value.startsWith('authorization.sqlite'))) {
    assert.equal((await lstat(join(directory, name))).mode & 0o077, 0);
  }
  const parentState = await parentRefresh;
  await childExit;
  const childResult = JSON.parse(stdout);
  assert.equal(parentState.credentials.accessToken, 'fresh-access-token');
  assert.equal(childResult.accessToken, 'fresh-access-token');
  assert.equal(Number(childResult.refreshed) + Number(parentRefreshed), 1);
  const final = await store.inspect();
  assert.equal(final.credentials.accessToken, 'fresh-access-token');
});

test('Remote MCP preserves protocol errors and exact business results, and never retries an unknown write', async () => {
  const definitions = [
    {name: 'list_actions', annotations: {readOnlyHint: true}},
    {name: 'apply_change', annotations: {readOnlyHint: false}},
  ];
  const config = {resourceEndpoint};
  const oauth = {accessToken: async () => 'local-secret-access-token'};
  const args = {schemaVersion: 2, operationId: 'operation-id', expectedRevision: 3, kind: 'add', payload: {title: 'Exact caller input'}};
  const toolResult = {jsonrpc: '2.0', id: 'remote-id', result: {isError: true, content: [{type: 'text', text: 'business rejection'}], structuredContent: {error: 'conflict'}, extra: true}};
  let captured;
  const result = await forwardBusinessCall({config, oauth, definitions, fetcher: async (url, options) => {
    captured = {url, options, body: JSON.parse(options.body)};
    return new Response(JSON.stringify({...toolResult, id: captured.body.id}), {status: 200, headers: {'content-type': 'application/json'}});
  }}, 'apply_change', args);
  assert.equal(captured.url, resourceEndpoint);
  assert.equal(captured.options.redirect, 'manual');
  assert.equal(captured.options.headers.authorization, 'Bearer local-secret-access-token');
  assert.equal(captured.body.method, 'tools/call');
  assert.equal(captured.body.params.name, 'apply_change');
  assert.deepEqual(captured.body.params.arguments, args);
  assert.deepEqual(result.result, toolResult.result);
  assert(!JSON.stringify(result).includes('local-secret-access-token'));

  const protocolError = {jsonrpc: '2.0', id: 'not-yet-known', error: {code: -32010, message: 'revision conflict', data: {revision: 5}}};
  const rejected = await forwardBusinessCall({config, oauth, definitions, fetcher: async (_url, options) => {
    const request = JSON.parse(options.body);
    return new Response(JSON.stringify({...protocolError, id: request.id}), {status: 422, headers: {'content-type': 'application/json'}});
  }}, 'apply_change', args);
  assert.deepEqual(rejected.error, protocolError.error);

  let calls = 0;
  await assert.rejects(forwardBusinessCall({config, oauth, definitions, fetcher: async () => { calls++; throw new Error('socket ended after request'); }}, 'apply_change', args), error => error.code === 'outcome_unknown');
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(forwardBusinessCall({config, oauth, definitions, fetcher: async () => { calls++; return new Response('', {status: 302, headers: {location: 'https://other.example.invalid/mcp'}}); }}, 'apply_change', args), error => error.code === 'outcome_unknown');
  assert.equal(calls, 1);
});

test('Remote 401 invalidates only the rejected current token and permits a new authorization', async t => {
  const {config, store, oauth} = await fixture(t);
  const definitions = [{name: 'apply_change', annotations: {readOnlyHint: false}}];
  const args = {schemaVersion: 2, operationId: '401-operation', expectedRevision: 2};
  const expiresAt = Math.floor(Date.now() / 1_000) + 3600;
  await store.saveAuthorization({accessToken: 'rejected-current-token', refreshToken: null, expiresAt}, 0);

  await assert.rejects(forwardBusinessCall({config, oauth, definitions, fetcher: async () => new Response('unauthorized', {status: 401})}, 'apply_change', args), error => error.code === 'unauthenticated');
  assert.equal((await store.inspect()).credentials, null);

  const flow = await oauth.connect();
  assert.equal(typeof flow.authorizationUrl, 'string');
  assert.equal(flow.alreadyConnected, undefined);
  await oauth.close();

  const current = await store.inspect();
  await store.saveAuthorization({accessToken: 'older-in-flight-token', refreshToken: null, expiresAt}, current.generation);
  await assert.rejects(forwardBusinessCall({config, oauth, definitions, fetcher: async () => {
    const newer = await store.inspect();
    await store.saveAuthorization({accessToken: 'newer-current-token', refreshToken: null, expiresAt}, newer.generation);
    return new Response('unauthorized', {status: 401});
  }}, 'apply_change', args), error => error.code === 'authorization_superseded');
  const afterDelayedResponse = await store.inspect();
  assert.equal(afterDelayedResponse.credentials.accessToken, 'newer-current-token');
  assert.equal(afterDelayedResponse.generation, current.generation);
});

test('Remote 403 preserves structured denial and identifies insufficient scope or disabled writes without clearing credentials', async t => {
  const {config, store, oauth} = await fixture(t);
  const definitions = [{name: 'apply_change', annotations: {readOnlyHint: false}}];
  const args = {schemaVersion: 2, operationId: '403-operation', expectedRevision: 2};
  const expiresAt = Math.floor(Date.now() / 1_000) + 3600;
  await store.saveAuthorization({accessToken: 'still-authorized-token', refreshToken: null, expiresAt}, 0);

  const structuredDenial = {jsonrpc: '2.0', id: '', error: {code: -32003, message: 'Write access is disabled by service configuration.', data: {kind: 'write_disabled'}}};
  const exact = await forwardBusinessCall({config, oauth, definitions, fetcher: async (_url, options) => {
    const request = JSON.parse(options.body);
    return new Response(JSON.stringify({...structuredDenial, id: request.id}), {status: 403, headers: {'content-type': 'application/json'}});
  }}, 'apply_change', args);
  assert.deepEqual(exact.error, structuredDenial.error);

  await assert.rejects(forwardBusinessCall({config, oauth, definitions, fetcher: async () => new Response(JSON.stringify({error: 'insufficient_scope', error_description: 'The client is missing actions:write.'}), {status: 403, headers: {'content-type': 'application/json', 'www-authenticate': 'Bearer error="insufficient_scope"'}})}, 'apply_change', args), error => error.code === 'insufficient_scope' && error.message.includes('actions:write'));
  await assert.rejects(forwardBusinessCall({config, oauth, definitions, fetcher: async () => new Response(JSON.stringify({error: 'write_mode_disabled', error_description: 'Write mode is disabled for this client.'}), {status: 403, headers: {'content-type': 'application/json'}})}, 'apply_change', args), error => error.code === 'write_disabled' && error.message.includes('Write mode is disabled'));
  assert.equal((await store.inspect()).credentials.accessToken, 'still-authorized-token');
});
