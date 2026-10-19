import {createServer} from 'node:http';
import {
  Configuration,
  None,
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  customFetch,
  dynamicClientRegistration,
  randomPKCECodeVerifier,
  randomState,
  refreshTokenGrant,
} from 'openid-client';
import {CALLBACK_URL} from './config.mjs';
import {LocalMcpError} from './errors.mjs';

const MAX_RESPONSE_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 8_000;
const AUTHORIZATION_LIFETIME_MS = 5 * 60_000;
const REGISTRATION_PROFILE_VERSION = 1;
const safePage = '<!doctype html><html><head><meta charset="utf-8"><title>action-tools</title></head><body>Authorization response received. Return to your local MCP client.</body></html>';

function validateHttpsEndpoint(value, expectedOrigin, name) {
  if (typeof value !== 'string' || value.length > 2048) throw new LocalMcpError('authorization_unavailable', `The authorization service returned an invalid ${name}.`);
  let url;
  try { url = new URL(value); } catch { throw new LocalMcpError('authorization_unavailable', `The authorization service returned an invalid ${name}.`); }
  if (url.protocol !== 'https:' || url.origin !== expectedOrigin || url.username || url.password || url.hash) {
    throw new LocalMcpError('authorization_unavailable', `The authorization service returned an untrusted ${name}.`);
  }
  return url;
}

async function boundedBody(response) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new LocalMcpError('authorization_unavailable', 'The authorization service response was too large.');
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new LocalMcpError('authorization_unavailable', 'The authorization service response was too large.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

function createTrustedFetch(allowedOrigins, fetcher = globalThis.fetch) {
  return async (input, init = {}) => {
    const target = new URL(input);
    if (target.protocol !== 'https:' || !allowedOrigins.has(target.origin) || target.username || target.password || target.hash) {
      throw new LocalMcpError('authorization_unavailable', 'An authorization request targeted an untrusted endpoint.');
    }
    const controller = new AbortController();
    const externalSignal = init.signal;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const abort = () => controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener('abort', abort, {once: true});
    try {
      const response = await fetcher(target, {...init, redirect: 'manual', signal: controller.signal});
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        throw new LocalMcpError('authorization_unavailable', 'The authorization service attempted an HTTP redirect.');
      }
      const body = await boundedBody(response);
      return new Response(body, {status: response.status, statusText: response.statusText, headers: response.headers});
    } catch (error) {
      if (error instanceof LocalMcpError) throw error;
      throw new LocalMcpError('authorization_unavailable', 'The authorization service could not be reached.', {cause: error});
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', abort);
    }
  };
}

async function fetchJson(fetcher, url, label) {
  const response = await fetcher(url, {method: 'GET', headers: {accept: 'application/json'}});
  if (response.status !== 200) throw new LocalMcpError('authorization_unavailable', `The ${label} endpoint returned HTTP ${response.status}.`);
  const type = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (type !== 'application/json' && !type?.endsWith('+json')) throw new LocalMcpError('authorization_unavailable', `The ${label} endpoint did not return JSON.`);
  try { return await response.json(); }
  catch (error) { throw new LocalMcpError('authorization_unavailable', `The ${label} endpoint returned invalid JSON.`, {cause: error}); }
}

async function discover(config, fetcher) {
  const issuerUrl = new URL(config.issuer);
  const metadataUrl = new URL('/.well-known/openid-configuration', issuerUrl.origin);
  const serverMetadata = await fetchJson(fetcher, metadataUrl, 'authorization discovery');
  if (!serverMetadata || typeof serverMetadata !== 'object' || serverMetadata.issuer !== config.issuer) {
    throw new LocalMcpError('authorization_unavailable', 'The discovered issuer does not exactly match the configured issuer.');
  }
  for (const [name, value] of Object.entries({authorization: serverMetadata.authorization_endpoint, token: serverMetadata.token_endpoint, keys: serverMetadata.jwks_uri})) {
    validateHttpsEndpoint(value, issuerUrl.origin, name);
  }
  if (serverMetadata.response_types_supported && !serverMetadata.response_types_supported.includes('code')) {
    throw new LocalMcpError('authorization_unavailable', 'The authorization service does not support authorization code flow.');
  }
  if (serverMetadata.token_endpoint_auth_methods_supported && !serverMetadata.token_endpoint_auth_methods_supported.includes('none')) {
    throw new LocalMcpError('authorization_unavailable', 'The authorization service does not advertise public-client token exchange.');
  }
  if (serverMetadata.code_challenge_methods_supported && !serverMetadata.code_challenge_methods_supported.includes('S256')) {
    throw new LocalMcpError('authorization_unavailable', 'The authorization service does not advertise PKCE S256.');
  }
  const resourceUrl = new URL(config.resourceEndpoint);
  const metadataPath = `/.well-known/oauth-protected-resource${resourceUrl.pathname === '/' ? '' : resourceUrl.pathname}`;
  const resourceMetadata = await fetchJson(fetcher, new URL(metadataPath, resourceUrl.origin), 'protected-resource metadata');
  if (resourceMetadata?.resource !== config.resourceEndpoint || !Array.isArray(resourceMetadata.authorization_servers) || !resourceMetadata.authorization_servers.includes(config.issuer)) {
    throw new LocalMcpError('authorization_unavailable', 'Protected-resource metadata does not exactly match the configured service and issuer.');
  }
  return serverMetadata;
}

function assertPublicRegistration(metadata) {
  const invalid = () => new LocalMcpError('authorization_unavailable', 'The authorization service returned an invalid public client registration.');
  const clientId = metadata?.client_id;
  if (typeof clientId !== 'string' || !clientId.trim() || clientId.length > 256 || /[\u0000-\u001f\u007f]/.test(clientId)
    || metadata.token_endpoint_auth_method !== 'none'
    || metadata.application_type !== 'native'
    || !Array.isArray(metadata.redirect_uris) || metadata.redirect_uris.length !== 1 || metadata.redirect_uris[0] !== CALLBACK_URL
    || !Array.isArray(metadata.response_types) || metadata.response_types.length !== 1 || metadata.response_types[0] !== 'code'
    || !Array.isArray(metadata.grant_types) || !metadata.grant_types.includes('authorization_code')
    || metadata.grant_types.some(value => !['authorization_code', 'refresh_token'].includes(value))
    || new Set(metadata.grant_types).size !== metadata.grant_types.length
    || (metadata.scope !== undefined && metadata.scope !== 'openid')
    || ['client_secret', 'client_secret_expires_at', 'registration_access_token', 'registration_client_uri'].some(key => Object.hasOwn(metadata, key))) {
    throw invalid();
  }
  return Object.freeze({
    profileVersion: REGISTRATION_PROFILE_VERSION,
    clientId,
    applicationType: 'native',
    redirectUris: [CALLBACK_URL],
    responseTypes: ['code'],
    grantTypes: [...metadata.grant_types],
    tokenEndpointAuthMethod: 'none',
  });
}

function storedRegistrationMetadata(registration) {
  if (!registration || typeof registration !== 'object' || Array.isArray(registration)
    || registration.profileVersion !== REGISTRATION_PROFILE_VERSION
    || typeof registration.clientId !== 'string' || !registration.clientId.trim() || registration.clientId.length > 256 || /[\u0000-\u001f\u007f]/.test(registration.clientId)
    || registration.applicationType !== 'native'
    || !Array.isArray(registration.redirectUris) || registration.redirectUris.length !== 1 || registration.redirectUris[0] !== CALLBACK_URL
    || !Array.isArray(registration.responseTypes) || registration.responseTypes.length !== 1 || registration.responseTypes[0] !== 'code'
    || !Array.isArray(registration.grantTypes) || !registration.grantTypes.includes('authorization_code')
    || registration.grantTypes.some(value => !['authorization_code', 'refresh_token'].includes(value))
    || new Set(registration.grantTypes).size !== registration.grantTypes.length
    || registration.tokenEndpointAuthMethod !== 'none') {
    throw new LocalMcpError('private_state_invalid', 'The saved local OAuth registration is invalid and must be reconnected.');
  }
  return {
    client_id: registration.clientId,
    application_type: registration.applicationType,
    redirect_uris: [...registration.redirectUris],
    response_types: [...registration.responseTypes],
    grant_types: [...registration.grantTypes],
    token_endpoint_auth_method: registration.tokenEndpointAuthMethod,
  };
}

function configuredClient(serverMetadata, registration, fetcher) {
  const oidc = new Configuration(serverMetadata, registration.clientId, storedRegistrationMetadata(registration), None());
  oidc.timeout = REQUEST_TIMEOUT_MS / 1_000;
  oidc[customFetch] = fetcher;
  return oidc;
}

async function registerPublicClient(config, fetcher, serverMetadata) {
  const registrationUrl = validateHttpsEndpoint(serverMetadata.registration_endpoint, new URL(config.issuer).origin, 'dynamic client registration');
  const discoveryUrl = new URL('/.well-known/openid-configuration', new URL(config.issuer).origin);
  const pinnedFetch = async (input, init = {}) => {
    const target = new URL(input);
    const method = (init.method ?? 'GET').toUpperCase();
    if ((method === 'POST' && target.href !== registrationUrl.href)
      || (method === 'GET' && target.href !== discoveryUrl.href)) {
      throw new LocalMcpError('authorization_unavailable', 'Dynamic client registration attempted an endpoint outside the validated issuer metadata.');
    }
    return fetcher(target, init);
  };
  let oidc;
  try {
    oidc = await dynamicClientRegistration(new URL(config.issuer), {
      application_type: 'native',
      redirect_uris: [CALLBACK_URL],
      response_types: ['code'],
      grant_types: ['authorization_code', 'refresh_token'],
      scope: 'openid',
      token_endpoint_auth_method: 'none',
    }, None(), {timeout: REQUEST_TIMEOUT_MS / 1_000, [customFetch]: pinnedFetch});
  } catch (error) {
    if (error instanceof LocalMcpError) throw error;
    throw new LocalMcpError('authorization_unavailable', 'The authorization service could not register a public local client.', {cause: error});
  }
  return assertPublicRegistration(oidc.clientMetadata());
}

function parseTokenResponse(tokens) {
  const accessToken = tokens?.access_token;
  const tokenType = tokens?.token_type;
  const expiresIn = tokens?.expires_in;
  const refreshToken = tokens?.refresh_token;
  if (typeof accessToken !== 'string' || accessToken.length < 1 || accessToken.length > 8192 || typeof tokenType !== 'string' || tokenType.toLowerCase() !== 'bearer' || !Number.isSafeInteger(expiresIn) || expiresIn < 1 || expiresIn > 86_400 || (refreshToken !== undefined && (typeof refreshToken !== 'string' || refreshToken.length < 1 || refreshToken.length > 8192))) {
    throw new LocalMcpError('authorization_unavailable', 'The authorization service returned an invalid token response.');
  }
  return {accessToken, refreshToken: refreshToken ?? null, expiresAt: Math.floor(Date.now() / 1_000) + expiresIn};
}

function oauthError(error) {
  let current = error;
  for (let depth = 0; current && depth < 5; depth++, current = current.cause) {
    if (current.code === 'invalid_grant' || current.error === 'invalid_grant' || current.cause?.error === 'invalid_grant') return 'invalid_grant';
  }
  return undefined;
}

function callbackFields(url) {
  const values = new Map();
  for (const [key, value] of url.searchParams) {
    if (values.has(key)) throw new LocalMcpError('callback_invalid', 'The authorization callback contained duplicate fields.');
    values.set(key, value);
  }
  const known = new Set(['state', 'code', 'error', 'error_description', 'iss']);
  if ([...values.keys()].some(key => !known.has(key))) throw new LocalMcpError('callback_invalid', 'The authorization callback contained unsupported fields.');
  return values;
}

export class LocalOAuthClient {
  #pending;

  constructor({config, store, fetcher = globalThis.fetch}) {
    this.config = config;
    this.store = store;
    this.fetcher = createTrustedFetch(new Set([new URL(config.issuer).origin, new URL(config.resourceEndpoint).origin]), fetcher);
  }

  async status() {
    const {credentials} = await this.store.inspect();
    return {connected: Boolean(credentials?.accessToken || credentials?.refreshToken), credentialState: credentials ? 'stored' : 'missing', serviceAcceptance: credentials ? 'not_checked' : 'not_connected'};
  }

  async invalidateRejectedAccessToken(accessToken) {
    return this.store.invalidateAccessToken(accessToken);
  }

  async disconnect() {
    await this.#closePending();
    await this.store.disconnect();
    return {connected: false, disconnected: true};
  }

  async close() {
    const pending = this.#pending;
    if (!pending) return;
    await this.#closePending(pending);
    await this.store.invalidatePendingAuthorization(pending.generation);
  }

  async connect() {
    const current = await this.store.inspect();
    if (current.credentials && (current.credentials.expiresAt > Math.floor(Date.now() / 1_000) + 30 || current.credentials.refreshToken)) {
      return {connected: true, alreadyConnected: true};
    }
    if (this.#pending) return {authorizationUrl: this.#pending.authorizationUrl, expiresAt: new Date(this.#pending.expiresAt).toISOString()};
    const serverMetadata = await discover(this.config, this.fetcher);
    const registration = await this.store.ensureRegistration(() => registerPublicClient(this.config, this.fetcher, serverMetadata));
    const oidc = configuredClient(serverMetadata, registration, this.fetcher);
    const state = randomState();
    const verifier = randomPKCECodeVerifier();
    const challenge = await calculatePKCECodeChallenge(verifier);
    const authorizationUrl = buildAuthorizationUrl(oidc, {
      client_id: registration.clientId,
      response_type: 'code',
      redirect_uri: CALLBACK_URL,
      scope: 'openid',
      resource: this.config.resourceEndpoint,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).href;
    const pending = {state, verifier, oidc, generation: current.generation, expiresAt: Date.now() + AUTHORIZATION_LIFETIME_MS, consumed: false, server: null, timer: null, authorizationUrl};
    const server = createServer((request, response) => { void this.#handleCallback(pending, request, response); });
    pending.server = server;
    this.#pending = pending;
    pending.timer = setTimeout(() => { void this.#closePending(pending); }, AUTHORIZATION_LIFETIME_MS);
    pending.timer.unref();
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(55437, '127.0.0.1', resolve);
      });
    } catch (error) {
      await this.#closePending(pending);
      if (error?.code === 'EADDRINUSE') throw new LocalMcpError('callback_port_in_use', 'Port 55437 is in use. Close the other action-tools authorization flow and try connect_action_service again.', {cause: error});
      throw new LocalMcpError('callback_unavailable', 'The loopback authorization callback could not be started.', {cause: error});
    }
    return {authorizationUrl, expiresAt: new Date(pending.expiresAt).toISOString()};
  }

  async #handleCallback(pending, request, response) {
    const answer = (status, message) => {
      response.writeHead(status, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'", 'x-content-type-options': 'nosniff'});
      response.end(message ?? safePage);
    };
    if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); answer(405); return; }
    let url;
    try { url = new URL(request.url ?? '/', CALLBACK_URL); }
    catch { answer(400); return; }
    if (url.pathname !== '/callback' || url.origin !== new URL(CALLBACK_URL).origin) { answer(404); return; }
    let fields;
    try { fields = callbackFields(url); }
    catch { answer(400); return; }
    if (Date.now() > pending.expiresAt) { answer(410); await this.#closePending(pending); return; }
    if (pending !== this.#pending || pending.consumed) { answer(410); return; }
    if (fields.get('state') !== pending.state) { answer(400); return; }
    const code = fields.get('code'), oauthFailure = fields.get('error');
    if ((code && oauthFailure) || (!code && !oauthFailure) || (code !== undefined && (code.length < 1 || code.length > 4096)) || (oauthFailure !== undefined && (oauthFailure.length < 1 || oauthFailure.length > 128))) { answer(400); return; }
    pending.consumed = true;
    clearTimeout(pending.timer);
    pending.server.close();
    if (oauthFailure) { answer(400, '<!doctype html><html><head><meta charset="utf-8"><title>action-tools</title></head><body>Authorization was not completed. Return to your local MCP client and try again.</body></html>'); this.#pending = undefined; return; }
    answer(200);
    try {
      const tokens = await authorizationCodeGrant(pending.oidc, url, {expectedState: pending.state, pkceCodeVerifier: pending.verifier, idTokenExpected: true}, {resource: this.config.resourceEndpoint, redirect_uri: CALLBACK_URL});
      const credentials = parseTokenResponse(tokens);
      await this.store.saveAuthorization(credentials, pending.generation);
    } catch {
      // The callback page and stderr deliberately omit authorization details and tokens.
    } finally {
      if (this.#pending === pending) this.#pending = undefined;
    }
  }

  async #closePending(expected = this.#pending) {
    const pending = expected;
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.consumed = true;
    if (pending.server?.listening) {
      await new Promise(resolve => pending.server.close(() => resolve()));
    } else if (pending.server) {
      pending.server.close();
    }
    if (this.#pending === pending) this.#pending = undefined;
  }

  async accessToken() {
    const state = await this.store.updateCredentials(async current => {
      const credentials = current.credentials;
      if (credentials.expiresAt > Math.floor(Date.now() / 1_000) + 30) return credentials;
      if (!credentials.refreshToken) return null;
      const serverMetadata = await discover(this.config, this.fetcher);
      const oidc = configuredClient(serverMetadata, current.registration, this.fetcher);
      let refreshed;
      try {
        refreshed = await refreshTokenGrant(oidc, credentials.refreshToken, {resource: this.config.resourceEndpoint});
      } catch (error) {
        if (oauthError(error) === 'invalid_grant') return null;
        throw new LocalMcpError('authorization_unavailable', 'The authorization service is temporarily unavailable; connection status is unchanged.', {cause: error});
      }
      const next = parseTokenResponse(refreshed);
      return {...next, refreshToken: next.refreshToken ?? credentials.refreshToken};
    });
    if (!state.credentials?.accessToken || state.credentials.expiresAt <= Math.floor(Date.now() / 1_000)) {
      throw new LocalMcpError('unauthenticated', 'The saved authorization has expired. Call connect_action_service and approve a new connection.');
    }
    return state.credentials.accessToken;
  }
}
