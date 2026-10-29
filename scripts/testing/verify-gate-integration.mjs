import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import {generateKeyPairSync, randomBytes, createHash, randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {postgresFixture} from '../../tests/helpers/postgres.mjs';
import {createIdentityStore} from '../../lib/adapters/postgres/identity-store.ts';
import {createPostgresActionStore, cursorScope} from '../../lib/adapters/postgres/action-store.ts';
import {actionCall} from '../../lib/application/action-service.ts';
import {createAuthentication, createGateVerification, sessionCookie} from '../../lib/server/node/authentication.ts';
import {createServer} from '../../lib/server/node/server.ts';
import {createGateVerifier} from '../../lib/server/node/gate-verifier.ts';
import {LocalOAuthClient} from '../../lib/mcp/local/oauth.mjs';
import {AuthorizationStateStore} from '../../lib/mcp/local/state-store.mjs';
import {configurationBinding} from '../../lib/mcp/local/config.mjs';
import {setTimeout as delay} from 'node:timers/promises';

if (process.env.NODE_ENV === 'production' || !/^(127\.0\.0\.1|localhost):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')) {
  throw new Error('Explicit loopback Firestore Emulator is required.');
}
const gateRoot = resolve(process.env.GATE_TEST_ROOT ?? '../syntoria-gate');
const {createService} = await import(pathToFileURL(join(gateRoot, 'dist/service.js')));
const {Storage, firestore} = await import(pathToFileURL(join(gateRoot, 'dist/storage.js')));
const directory = await mkdtemp(join(tmpdir(), 'weave-real-gate-'));
const cert = join(directory, 'cert.pem');
const key = join(directory, 'key.pem');
const generated = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=gate.example.test', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:gate.example.test'], {stdio: 'ignore'});
if (generated.status !== 0) throw new Error('Integration TLS certificate generation failed.');
const ca = await readFile(cert);
const keyBytes = await readFile(key);
const reservation = net.createServer();
await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
const gatePort = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));

const issuer = 'https://gate.example.test:' + gatePort;
const apiHost = 'weave.example.test';
const origin = 'https://' + apiHost;
const resource = origin + '/mcp';
const appOrigin = 'https://app.example.test';
const secondAppOrigin = 'https://other.example.test';
const callback = 'http://127.0.0.1:55437/callback';
const subject = 'github:12345';
const otherResource = 'https://other.example.test/mcp';
const resourceSecret = 'weave-resource-secret-' + 's'.repeat(32);
const otherResourceSecret = 'other-resource-secret-' + 'o'.repeat(32);
const {privateKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
const jwk = {...privateKey.export({format: 'jwk'}), kid: 'integration-key', use: 'sig', alg: 'RS256'};
const namespace = 'weave_integration_' + randomBytes(12).toString('hex');
const db = firestore('demo-gate-test', '(default)');
const storage = new Storage(db, namespace);
const gateConfig = {
  issuer,
  firestoreProjectId: 'demo-gate-test',
  firestoreDatabaseId: '(default)',
  githubClientId: 'synthetic-github-client',
  githubClientSecret: 'synthetic-github-secret',
  githubUserId: '12345',
  cookieKeys: ['a'.repeat(64)],
  jwks: {keys: [jwk]},
  port: gatePort,
  sessionCookieDomain: 'example.test',
  browserSessionTtlSeconds: 3600,
  browserApps: [
    {app_id: 'weave', app_name: 'Weave', redirect_uris: [appOrigin + '/auth-return.html']},
    {app_id: 'other-suite', app_name: 'Other suite app', redirect_uris: [secondAppOrigin + '/auth-return.html']},
  ],
  browserOrigins: Object.freeze([appOrigin, secondAppOrigin]),
  resources: [
    {audience: resource, client_id: 'weave-resource', client_secret: resourceSecret, browser_client_id: 'weave-browser'},
    {audience: otherResource, client_id: 'other-resource', client_secret: otherResourceSecret, browser_client_id: 'other-browser'},
  ],
};

let gateServer;
let weave;
let fixture;
let localOAuth;
let gateAvailable = true;
const cookies = new Map();

function bodyText(body) {
  if (body instanceof URLSearchParams) return body.toString();
  if (body === undefined || body === null) return undefined;
  return typeof body === 'string' || Buffer.isBuffer(body) ? body : String(body);
}

function httpsRequest(input, options = {}) {
  const target = new URL(input);
  assert.equal(target.origin, issuer, 'integration requests must remain on the isolated Gate issuer');
  const headers = {...options.headers, host: target.host};
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: '127.0.0.1',
      port: gatePort,
      path: target.pathname + target.search,
      method: options.method ?? 'GET',
      headers,
      ca,
      servername: new URL(issuer).hostname,
      signal: options.signal,
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        resolve({status: res.statusCode ?? 0, headers: res.headers, data, text: data.toString(), location: res.headers.location});
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('Gate integration HTTP timeout')));
    req.end(bodyText(options.body));
  });
}

async function trustedFetch(input, options = {}) {
  if (!gateAvailable) throw new Error('Synthetic network outage');
  const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const requestHeaders = Object.fromEntries(new Headers(options.headers ?? (input instanceof Request ? input.headers : undefined)));
  const reply = await httpsRequest(target.href, {
    method: options.method ?? (input instanceof Request ? input.method : 'GET'),
    headers: requestHeaders,
    body: options.body ?? (input instanceof Request ? input.body : undefined),
    signal: options.signal,
  });
  const response = new Response(reply.data, {status: reply.status, headers: reply.headers});
  Object.defineProperty(response, 'url', {value: target.href});
  return response;
}

async function requestGate(input, options = {}, browser = false) {
  const target = new URL(input instanceof URL ? input.href : String(input), issuer);
  assert.equal(target.origin, issuer, 'test must not contact external identity endpoints');
  const headers = {...options.headers};
  if (browser) {
    const active = [...cookies].filter(([, value]) => target.pathname.startsWith(value.path)).map(([name, value]) => name + '=' + value.value);
    if (active.length) headers.cookie = active.join('; ');
  }
  const reply = await httpsRequest(target.href, {...options, headers});
  if (browser) {
    for (const entry of reply.headers['set-cookie'] ?? []) {
      const [pair, ...attributes] = entry.split(';');
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      const maxAge = attributes.find(attribute => /^\s*max-age=/i.test(attribute))?.split('=', 2)[1];
      if (maxAge === '0' || !value) cookies.delete(name);
      else cookies.set(name, {value, path: /(?:^|;)\s*path=([^;]+)/i.exec(entry)?.[1] ?? '/'});
    }
  }
  return reply;
}

async function approveBrowserSession(appId, redirectUri) {
  const params = new URLSearchParams({app_id: appId, redirect_uri: redirectUri});
  const started = await requestGate('/browser/login?' + params, {}, true);
  assert.equal(started.status, 303, started.text);
  const github = new URL(started.location);
  assert.equal(github.origin, 'https://github.com');
  const state = github.searchParams.get('state');
  assert.ok(state);
  const identity = await requestGate('/github/callback?' + new URLSearchParams({state, code: 'synthetic-code'}), {}, true);
  assert.equal(identity.status, 303, identity.text);
  const approvalUrl = new URL(identity.location, issuer);
  assert.equal(approvalUrl.pathname, '/browser/approve');
  const page = await requestGate(approvalUrl, {}, true);
  assert.equal(page.status, 200, page.text);
  const transaction = /name="transaction" value="([^"]+)"/.exec(page.text)?.[1];
  const csrf = /name="csrf" value="([^"]+)"/.exec(page.text)?.[1];
  assert.ok(transaction);
  assert.ok(csrf);
  assert.match(page.text, /full access to registered suite resources/);
  const approved = await requestGate('/browser/approve', {
    method: 'POST',
    headers: {origin: issuer, 'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({transaction, csrf, decision: 'approve'}),
  }, true);
  assert.equal(approved.status, 303, approved.text);
  assert.equal(approved.location, redirectUri);
  return {redirectUri, csrf};
}

async function approveOAuthAuthorization(start) {
  let reply = start;
  const callbackOrigin = new URL(callback).origin;
  for (let count = 0; count < 30; count++) {
    assert([302, 303].includes(reply.status), reply.text);
    const next = new URL(reply.location, issuer);
    if (next.origin === callbackOrigin) return next;
    if (next.origin === 'https://github.com') {
      const state = next.searchParams.get('state');
      assert.ok(state);
      reply = await requestGate('/github/callback?' + new URLSearchParams({state, code: 'synthetic-code'}), {}, true);
      continue;
    }
    assert.equal(next.origin, issuer, 'OAuth may only redirect within Gate or to the registered local callback');
    reply = await requestGate(next, {}, true);
    if (reply.status === 200 && next.pathname.startsWith('/interaction/')) {
      const csrf = /name="csrf" value="([^"]+)"/.exec(reply.text)?.[1];
      assert.ok(csrf, reply.text);
      reply = await requestGate(next, {
        method: 'POST',
        headers: {origin: issuer, 'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({csrf, decision: 'approve'}),
      }, true);
    }
  }
  throw new Error('Gate OAuth authorization exceeded its bounded redirect count');
}

function apiRequest(port, path, options = {}) {
  const headers = {host: apiHost, ...options.headers};
  let body = options.body;
  if (body && typeof body !== 'string' && !Buffer.isBuffer(body)) {
    body = JSON.stringify(body);
    headers['content-type'] ??= 'application/json';
  }
  return new Promise((resolve, reject) => {
    const req = http.request({host: '127.0.0.1', port, path, method: options.method ?? 'GET', headers}, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        resolve({status: res.statusCode ?? 0, headers: res.headers, data, text: data.toString()});
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Weave API integration HTTP timeout')));
    req.end(body);
  });
}

function rawHttp(port, request) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    let response = '';
    socket.setTimeout(3000, () => socket.destroy(new Error('Raw HTTP integration timeout')));
    socket.on('connect', () => socket.write(request));
    socket.on('data', chunk => { response += chunk.toString('latin1'); });
    socket.on('error', reject);
    socket.on('end', () => resolve(Number(response.match(/^HTTP\/1\.[01] (\d{3})/m)?.[1])));
  });
}

function json(reply) {
  return JSON.parse(reply.text);
}

try {
  const service = await createService(gateConfig, storage, {
    exchange: async code => {
      assert.equal(code, 'synthetic-code');
      return '12345';
    },
  });
  gateServer = https.createServer({cert: ca, key: keyBytes}, (req, res) => service.server.emit('request', req, res));
  await new Promise((resolve, reject) => { gateServer.once('error', reject); gateServer.listen(gatePort, '127.0.0.1', resolve); });

  fixture = await postgresFixture();
  const config = {
    origin,
    issuer,
    resource,
    browserClientId: 'weave-browser',
    spaOrigins: Object.freeze([appOrigin]),
    sharedCookieDomain: 'example.test',
    gateClientId: 'weave-resource',
    gateClientSecret: resourceSecret,
    databaseUrl: fixture.url,
    cursorEpoch: randomUUID(),
    writeMode: 'enabled',
    clientWriteApproval: 'auto',
    port: 8080,
    localDatabase: true,
  };
  await fixture.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3)', [issuer, subject, 'integration-user']);

  const identityStore = createIdentityStore(fixture.pool);
  const verification = createGateVerification(config, {fetch: trustedFetch});
  const authentication = createAuthentication(config, identityStore, verification);
  weave = createServer({
    config,
    authentication,
    invoke: (principal, name, args, signal) => actionCall({
      store: createPostgresActionStore(fixture.pool, principal, {
        signal,
        revalidate: client => authentication.revalidate(principal, client),
      }),
      clock: () => new Date().toISOString(),
      newId: randomUUID,
      changeCursorScope: async () => cursorScope(principal.user, config.cursorEpoch),
    }, name, args),
  });
  const address = await weave.listen({host: '127.0.0.1', port: 0});
  const apiPort = Number(new URL(address).port);

  const spaRedirect = appOrigin + '/auth-return.html';
  await approveBrowserSession('weave', spaRedirect);
  const sessionEntry = [...cookies.entries()].find(([name]) => name === sessionCookie);
  assert.ok(sessionEntry, 'Gate issues its shared browser session only after device approval');
  const browserSecret = sessionEntry[1].value;
  const cookie = sessionCookie + '=' + browserSecret;
  const browserPrincipal = await verification.verifySession(browserSecret);
  assert.equal(browserPrincipal.issuer, issuer);
  assert.equal(browserPrincipal.userId, subject);
  assert.equal(browserPrincipal.clientId, 'weave-browser');
  assert.equal(browserPrincipal.sessionType, 'browser');

  const browserConnections = async () => {
    const documents = await db.collection(namespace + '_connections').get();
    return documents.docs.map(document => document.data()).filter(connection => connection.kind === 'browser' && connection.approved && !connection.revoked);
  };
  assert.equal((await browserConnections()).length, 1);
  const reuse = await requestGate('/browser/login?' + new URLSearchParams({
    app_id: 'other-suite',
    redirect_uri: secondAppOrigin + '/auth-return.html',
  }), {}, true);
  assert.equal(reuse.status, 303, reuse.text);
  assert.equal(reuse.location, secondAppOrigin + '/auth-return.html');
  assert.equal((await browserConnections()).length, 1, 'another registered SPA reuses the approved device connection');

  const bootstrap = await requestGate('/browser/session', {headers: {origin: appOrigin}}, true);
  assert.equal(bootstrap.status, 200, bootstrap.text);
  assert.equal(bootstrap.headers['access-control-allow-origin'], appOrigin);
  assert.equal(bootstrap.headers['access-control-allow-credentials'], 'true');
  assert.equal(json(bootstrap).csrf_token, browserPrincipal.csrfToken);
  const deniedBootstrap = await requestGate('/browser/session', {headers: {origin: 'https://attacker.example.test'}}, true);
  assert.equal(deniedBootstrap.status, 403);

  const otherVerifier = createGateVerifier({
    issuer,
    audience: otherResource,
    clientId: 'other-resource',
    clientSecret: otherResourceSecret,
    browserClientId: 'other-browser',
  }, {fetch: trustedFetch});
  const otherPrincipal = await otherVerifier.verifySession(browserSecret);
  assert.equal(otherPrincipal.userId, browserPrincipal.userId);
  assert.equal(otherPrincipal.connectionId, browserPrincipal.connectionId);
  assert.equal(otherPrincipal.clientId, 'other-browser');

  const wrongResource = await requestGate('/browser/session/introspect', {
    method: 'POST',
    headers: {
      authorization: 'Basic ' + Buffer.from('weave-resource:' + resourceSecret).toString('base64'),
      'content-type': 'application/json',
    },
    body: JSON.stringify({session: browserSecret, resource: otherResource}),
  });
  assert.equal(wrongResource.status, 403);

  const sessionRequest = await apiRequest(apiPort, '/api/session', {headers: {origin: appOrigin, cookie}});
  assert.equal(sessionRequest.status, 200, sessionRequest.text);
  assert.equal(sessionRequest.headers['access-control-allow-origin'], appOrigin);
  assert.equal(sessionRequest.headers['access-control-allow-credentials'], 'true');
  const session = json(sessionRequest);
  assert.match(session.account_scope, /^[0-9a-f]{64}$/);
  assert.equal(session.csrf_token, browserPrincipal.csrfToken);

  const preflight = await apiRequest(apiPort, '/api/actions', {
    method: 'OPTIONS',
    headers: {origin: appOrigin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type, x-csrf-token'},
  });
  assert.equal(preflight.status, 204, preflight.text);
  assert.equal(preflight.headers['access-control-allow-origin'], appOrigin);
  assert.equal(preflight.headers['access-control-allow-credentials'], 'true');
  assert.equal(preflight.headers['access-control-allow-headers'], 'content-type, x-csrf-token');
  assert.equal((await apiRequest(apiPort, '/api/session', {headers: {origin: 'https://attacker.example.test', cookie}})).status, 403);
  assert.equal((await apiRequest(apiPort, '/api/session', {headers: {authorization: 'Bearer ignored', cookie}})).status, 401);
  assert.equal((await apiRequest(apiPort, '/api/session')).status, 401);

  const duplicateCookie = await rawHttp(apiPort,
    'GET /api/session HTTP/1.1\r\nHost: ' + apiHost + '\r\n' +
    'Origin: ' + appOrigin + '\r\nCookie: ' + cookie + '\r\nCookie: ' + cookie + '\r\nConnection: close\r\n\r\n');
  assert.equal(duplicateCookie, 401);
  const duplicateOrigin = await rawHttp(apiPort,
    'OPTIONS /api/actions HTTP/1.1\r\nHost: ' + apiHost + '\r\nOrigin: ' + appOrigin + '\r\n' +
    'Origin: https://attacker.example.test\r\nAccess-Control-Request-Method: POST\r\nConnection: close\r\n\r\n');
  assert.equal(duplicateOrigin, 403);

  const deniedWrite = await apiRequest(apiPort, '/api/actions', {
    method: 'POST',
    headers: {cookie, origin: appOrigin, 'content-type': 'application/json'},
    body: {name: 'apply_change', arguments: {schemaVersion: 2, operationId: randomUUID(), expectedRevision: 0, kind: 'add', payload: {title: 'must not be written'}}},
  });
  assert.equal(deniedWrite.status, 403);

  const request = {
    schemaVersion: 2,
    operationId: randomUUID(),
    expectedRevision: 0,
    kind: 'add',
    payload: {title: 'Actual Gate to Weave PostgreSQL integration'},
  };
  const write = {name: 'apply_change', arguments: request};
  const browserHeaders = {'content-type': 'application/json', origin: appOrigin, cookie, 'x-csrf-token': session.csrf_token};
  const saved = await apiRequest(apiPort, '/api/actions', {method: 'POST', headers: browserHeaders, body: write});
  assert.equal(saved.status, 200, saved.text);
  assert.equal(json(saved).revision, 1);
  const replay = await apiRequest(apiPort, '/api/actions', {method: 'POST', headers: browserHeaders, body: write});
  assert.equal(replay.status, 200, replay.text);
  assert.equal(json(replay).revision, 1);

  const discovery = json(await requestGate('/.well-known/openid-configuration'));
  assert.equal(discovery.registration_endpoint, issuer + '/reg');
  const registrationReply = await requestGate(discovery.registration_endpoint, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      client_name: 'MCP integration', application_type: 'native',
      redirect_uris: [callback], token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
    }),
  });
  assert.equal(registrationReply.status, 201, registrationReply.text);
  const registered = json(registrationReply);
  assert.equal(registered.client_secret, undefined);
  assert.ok(registered.client_id);
  assert.equal((await fixture.admin.query('SELECT count(*)::int AS count FROM identity.subjects')).rows[0].count, 1);

  const unsafeRegistration = await requestGate(discovery.registration_endpoint, {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({redirect_uris: ['https://client.example.test/*'], token_endpoint_auth_method: 'none'}),
  });
  assert.equal(unsafeRegistration.status, 400, unsafeRegistration.text);

  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const authorizationUrl = '/auth?' + new URLSearchParams({
    client_id: registered.client_id,
    redirect_uri: callback,
    response_type: 'code',
    scope: 'openid',
    resource,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: 'weave-gate-integration',
  });
  const authorized = await approveOAuthAuthorization(await requestGate(authorizationUrl, {}, true));
  assert.equal(authorized.pathname, new URL(callback).pathname);
  const tokenReply = await requestGate('/token', {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: registered.client_id,
      redirect_uri: callback,
      code: authorized.searchParams.get('code'),
      code_verifier: codeVerifier,
    }),
  });
  assert.equal(tokenReply.status, 200, tokenReply.text);
  const mcpTokens = JSON.parse(tokenReply.text);
  const refreshedReply = await requestGate('/token', {
    method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({grant_type: 'refresh_token', client_id: registered.client_id, refresh_token: JSON.parse(tokenReply.text).refresh_token, resource}),
  });
  assert.equal(refreshedReply.status, 200, refreshedReply.text);
  Object.assign(mcpTokens, json(refreshedReply));

  const mcpPayload = {jsonrpc: '2.0', id: 1, method: 'tools/list'};
  const mcpReply = await apiRequest(apiPort, '/mcp', {
    method: 'POST',
    headers: {'content-type': 'application/json', authorization: 'Bearer ' + mcpTokens.access_token},
    body: mcpPayload,
  });
  assert.equal(mcpReply.status, 200, mcpReply.text);
  assert.ok(json(mcpReply).result.tools.some(tool => tool.name === 'apply_change'));
  assert.equal((await fixture.admin.query('SELECT count(*)::int AS count FROM identity.sessions')).rows[0].count, 0);

  const localConfig = {issuer, resourceEndpoint: resource};
  const localState = new AuthorizationStateStore(join(directory, 'local-consumer'), configurationBinding(localConfig));
  localOAuth = new LocalOAuthClient({config: localConfig, store: localState, fetcher: async (input, options = {}) => {
    const target = new URL(input);
    if (target.origin === issuer) return trustedFetch(input, options);
    assert.equal(target.origin, origin);
    const reply = await apiRequest(apiPort, target.pathname + target.search, options);
    return new Response(reply.data, {status: reply.status, headers: reply.headers});
  }});
  const localConnection = await localOAuth.connect();
  const localCallback = await approveOAuthAuthorization(await requestGate(localConnection.authorizationUrl, {}, true));
  const callbackReply = await fetch(localCallback, {redirect: 'error'});
  assert.equal(callbackReply.status, 200);
  for (let count = 0; count < 100 && !(await localState.inspect()).credentials; count++) await delay(20);
  const localConnected = await localState.inspect();
  assert.ok(localConnected.credentials, 'maintained local OAuth client completes actual Gate DCR and code exchange');
  const localRegistrationId = localConnected.registration.clientId;
  assert.notEqual(localRegistrationId, registered.client_id);
  assert.equal((await verification.verifyToken(await localOAuth.accessToken())).clientId, localRegistrationId);
  await localState.updateCredentials(state => ({...state.credentials, expiresAt: 0}));
  assert.equal((await verification.verifyToken(await localOAuth.accessToken())).clientId, localRegistrationId, 'refresh reuses the persisted DCR client');
  await localOAuth.disconnect();
  assert.equal((await localState.inspect()).registration.clientId, localRegistrationId);
  const localReconnect = await localOAuth.connect();
  assert.equal(new URL(localReconnect.authorizationUrl).searchParams.get('client_id'), localRegistrationId);
  await localOAuth.close();

  const undo = {
    schemaVersion: 2,
    operationId: randomUUID(),
    expectedRevision: 1,
    undoOf: request.operationId,
  };
  const undone = await apiRequest(apiPort, '/api/actions', {
    method: 'POST',
    headers: browserHeaders,
    body: {name: 'undo_change', arguments: undo},
  });
  assert.equal(undone.status, 200, undone.text);
  assert.equal(json(undone).revision, 2);
  const replayAfterCorrection = await apiRequest(apiPort, '/api/actions', {
    method: 'POST',
    headers: browserHeaders,
    body: write,
  });
  assert.equal(replayAfterCorrection.status, 200, replayAfterCorrection.text);
  assert.equal(json(replayAfterCorrection).revision, 2);
  assert.equal((await fixture.admin.query('SELECT count(*)::int AS count FROM state.operations')).rows[0].count, 2);
  const retained = await fixture.admin.query('SELECT status FROM state.actions WHERE user_id = $1', ['integration-user']);
  assert.deepEqual(retained.rows.map(row => row.status), ['dropped']);

  const dynamicWrite = {schemaVersion: 2, operationId: randomUUID(), expectedRevision: 2, kind: 'add', payload: {title: 'DCR authorized MCP write'}};
  const mcpHeaders = {'content-type': 'application/json', authorization: 'Bearer ' + mcpTokens.access_token};
  const callMcp = (name, args) => apiRequest(apiPort, '/mcp', {
    method: 'POST', headers: mcpHeaders,
    body: {jsonrpc: '2.0', id: 2, method: 'tools/call', params: {name, arguments: args}},
  });
  const dynamicSaved = await callMcp('apply_change', dynamicWrite);
  assert.equal(dynamicSaved.status, 200, dynamicSaved.text);
  assert.equal(json(dynamicSaved).result.structuredContent.revision, 3, dynamicSaved.text);
  const dynamicReplayed = await callMcp('apply_change', dynamicWrite);
  assert.equal(dynamicReplayed.status, 200, dynamicReplayed.text);
  assert.equal(json(dynamicReplayed).result.structuredContent.revision, 3, dynamicReplayed.text);
  const dynamicUndone = await callMcp('undo_change', {schemaVersion: 2, operationId: randomUUID(), expectedRevision: 3, undoOf: dynamicWrite.operationId});
  assert.equal(dynamicUndone.status, 200, dynamicUndone.text);
  assert.equal(json(dynamicUndone).result.structuredContent.revision, 4, dynamicUndone.text);

  gateAvailable = false;
  try {
    const outage = await apiRequest(apiPort, '/api/session', {headers: {origin: appOrigin, cookie}});
    assert.equal(outage.status, 503, outage.text);
  } finally { gateAvailable = true; }
  const browserLogout = await requestGate('/browser/logout', {
    method: 'POST',
    headers: {origin: appOrigin, 'content-type': 'application/json', 'x-csrf-token': browserPrincipal.csrfToken},
    body: '{}',
  }, true);
  assert.equal(browserLogout.status, 204, browserLogout.text);
  assert.equal((await apiRequest(apiPort, '/api/session', {headers: {origin: appOrigin, cookie}})).status, 401);
  assert.equal((await apiRequest(apiPort, '/mcp', {
    method: 'POST',
    headers: {'content-type': 'application/json', authorization: 'Bearer ' + mcpTokens.access_token},
    body: mcpPayload,
  })).status, 200, 'browser logout leaves the independently approved MCP connection intact');
  assert.equal((await fixture.admin.query('SELECT count(*)::int AS count FROM identity.sessions')).rows[0].count, 0);

  await fixture.admin.query('UPDATE identity.subjects SET enabled=false WHERE issuer=$1 AND subject=$2', [issuer, subject]);
  assert.equal((await apiRequest(apiPort, '/mcp', {
    method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + mcpTokens.access_token}, body: mcpPayload,
  })).status, 403, 'an approved DCR client cannot bypass disabled local subject admission');
  await fixture.admin.query('UPDATE identity.subjects SET enabled=true WHERE issuer=$1 AND subject=$2', [issuer, subject]);
  const verifiedMcp = await verification.verifyToken(mcpTokens.access_token);
  assert.equal(verifiedMcp.clientId, registered.client_id);
  await storage.revoke(verifiedMcp.connectionId, subject);
  assert.equal((await apiRequest(apiPort, '/mcp', {
    method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + mcpTokens.access_token}, body: mcpPayload,
  })).status, 401, 'revoked DCR connection cannot access Weave');

  console.log(JSON.stringify({
    actual_gate_firestore_weave_postgres: 'passed',
    explicit_browser_device_approval: true,
    shared_session_reused_by_second_spa: true,
    cross_resource_session_binding: true,
    direct_cookie_api_cors_csrf: true,
    raw_duplicate_header_rejection: true,
    wrong_resource: true,
    write_replay_undo_and_corrected_replay: true,
    gate_outage_and_revocation: true,
    independent_mcp_dcr_pkce_refresh_and_bearer: true,
    dynamic_client_subject_admission_and_revoke: true,
    maintained_local_consumer_dcr_exchange_refresh_reuse: true,
    weave_session_persistence: false,
    external_github_login: false,
    hosted_neon_browser_and_cloud_run: false,
  }));
} finally {
  await localOAuth?.close();
  await weave?.close();
  if (gateServer?.listening) await new Promise(resolve => gateServer.close(resolve));
  await fixture?.close();
  await db.terminate();
  await rm(directory, {recursive: true, force: true});
}
