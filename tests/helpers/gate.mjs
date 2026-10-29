import https from 'node:https';
import {spawnSync} from 'node:child_process';
import {createHash, generateKeyPairSync, randomBytes, randomUUID} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SignJWT} from 'jose';

/** A real HTTPS authorization/introspection fixture; it is not a hosted Gate acceptance substitute. */
export async function gateFixture({issuerHost = '127.0.0.1'} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'action-gate-'));
  const cert = join(directory, 'cert.pem'), key = join(directory, 'key.pem');
  if (!['127.0.0.1', 'gate.example.localhost'].includes(issuerHost)) throw new Error('Synthetic Gate fixture host is not allowed.');
  const generated = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:gate.example.localhost'], {stdio: 'ignore'});
  if (generated.status !== 0) throw new Error('Synthetic Gate TLS certificate generation failed.');
  const tokens = new Map(), sessions = new Map(), codes = new Map();
  const keys = generateKeyPairSync('rsa', {modulusLength: 2048});
  const keyId = 'synthetic-gate-key';
  const publicJwk = {...keys.publicKey.export({format: 'jwk'}), kid: keyId, use: 'sig', alg: 'RS256'};
  let issuer, requests = 0, sessionRequests = 0, refreshes = 0, authorizations = 0, unavailable = false;

  async function issueTokens({subject, clientId, audience, refreshToken}) {
    const expiry = Math.floor(Date.now() / 1_000) + 900;
    const access = randomUUID(), nextRefresh = refreshToken ?? randomUUID();
    const record = {active: true, token_type: 'Bearer', gate_approved: true, iss: issuer, sub: subject, client_id: clientId, aud: audience, exp: expiry, connection_id: randomUUID()};
    tokens.set(access, record);
    tokens.set(nextRefresh, record);
    const idToken = await new SignJWT({})
      .setProtectedHeader({alg: 'RS256', kid: keyId})
      .setIssuer(issuer)
      .setAudience(clientId)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(keys.privateKey);
    return {access_token: access, refresh_token: nextRefresh, token_type: 'Bearer', expires_in: 900, id_token: idToken};
  }

  const server = https.createServer({key: await readFile(key), cert: await readFile(cert)}, async (req, res) => {
    res.setHeader('content-type', 'application/json');
    if (unavailable) { res.writeHead(503); res.end('{}'); return; }
    if (req.url === '/.well-known/openid-configuration') {
      res.end(JSON.stringify({issuer, introspection_endpoint: issuer + '/introspect', authorization_endpoint: issuer + '/auth', token_endpoint: issuer + '/token', jwks_uri: issuer + '/jwks', response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], scopes_supported: ['openid'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'], token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256']}));
      return;
    }
    if (req.url === '/jwks' && req.method === 'GET') { res.end(JSON.stringify({keys: [publicJwk]})); return; }
    if (req.url === '/introspect' && req.method === 'POST') {
      requests++;
      let body = ''; for await (const chunk of req) body += chunk;
      if (req.headers.authorization !== 'Basic ' + Buffer.from('resource:synthetic-secret').toString('base64')) { res.writeHead(401); res.end('{}'); return; }
      res.end(JSON.stringify(tokens.get(new URLSearchParams(body).get('token')) ?? {active: false}));
      return;
    }
    if (req.url === '/browser/session/introspect' && req.method === 'POST') {
      sessionRequests++;
      let body = ''; for await (const chunk of req) body += chunk;
      if (req.headers.authorization !== 'Basic ' + Buffer.from('resource:synthetic-secret').toString('base64')) { res.writeHead(401); res.end('{}'); return; }
      let input; try { input = JSON.parse(body); } catch { res.writeHead(400); res.end('{}'); return; }
      const record = sessions.get(input.session);
      if (!record) { res.end(JSON.stringify({active: false})); return; }
      if (input.resource !== record.aud) { res.writeHead(403); res.end('{}'); return; }
      if (!record.active || record.exp <= Math.floor(Date.now() / 1_000)) { res.end(JSON.stringify({active: false})); return; }
      const {active, ...principal} = record; res.end(JSON.stringify({active, ...principal}));
      return;
    }
    if (req.url === '/token' && req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk;
      const fields = new URLSearchParams(body), grant = fields.get('grant_type');
      if (grant === 'authorization_code') {
        const code = fields.get('code'), record = codes.get(code);
        const verifier = fields.get('code_verifier') ?? '';
        const challenge = createHash('sha256').update(verifier).digest('base64url');
        if (!record || record.used || fields.get('client_id') !== record.clientId || fields.get('redirect_uri') !== record.redirectUri || fields.get('resource') !== record.audience || challenge !== record.challenge) {
          res.writeHead(400); res.end(JSON.stringify({error: 'invalid_grant'})); return;
        }
        record.used = true;
        authorizations++;
        res.end(JSON.stringify(await issueTokens(record)));
        return;
      }
      const refresh = fields.get('refresh_token'), record = tokens.get(refresh);
      if (grant !== 'refresh_token' || !record?.active) { res.writeHead(400); res.end(JSON.stringify({error: 'invalid_grant'})); return; }
      refreshes++;
      tokens.delete(refresh);
      res.end(JSON.stringify(await issueTokens({subject: record.sub, clientId: record.client_id, audience: record.aud, refreshToken: randomUUID()})));
      return;
    }
    res.writeHead(404); res.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  issuer = 'https://' + issuerHost + ':' + server.address().port;
  const awaitCertificate = await readFile(cert);
  const fetcher = async (url, options = {}) => new Promise((resolve, reject) => {
    const actual = https.request(url, {method: options.method ?? 'GET', headers: options.headers, ca: awaitCertificate, rejectUnauthorized: true, signal: options.signal}, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(new Response(Buffer.concat(chunks), {status: response.statusCode, headers: response.headers})));
    });
    actual.on('error', reject);
    actual.end(options.body instanceof URLSearchParams ? options.body.toString() : options.body);
  });

  return {
    issuer, port: server.address().port, cert, tokens, sessions,
    get requests() { return requests; }, get sessionRequests() { return sessionRequests; }, get refreshes() { return refreshes; }, get authorizations() { return authorizations; },
    set unavailable(value) { unavailable = value; },
    token({subject = 'person', client = 'mcp', audience = 'https://api.example.com/mcp', expiry = Math.floor(Date.now() / 1_000) + 900, connectionId = randomUUID(), name} = {}) {
      const token = randomUUID(); tokens.set(token, {active: true, token_type: 'Bearer', gate_approved: true, iss: issuer, sub: subject, client_id: client, aud: audience, exp: expiry, connection_id: connectionId, ...(name === undefined ? {} : {client_name: name})}); return token;
    },
    session({subject = 'person', client = 'web', audience = 'https://api.example.com/mcp', expiry = Math.floor(Date.now() / 1_000) + 900, connectionId = randomUUID(), csrfToken = 'synthetic-csrf'} = {}) {
      const session = randomBytes(32).toString('base64url'); sessions.set(session, {active: true, iss: issuer, sub: subject, client_id: client, aud: audience, exp: expiry, connection_id: connectionId, gate_approved: true, session_type: 'browser', csrf_token: csrfToken}); return session;
    },
    authorize(authorizationUrl, {subject = 'person'} = {}) {
      const url = new URL(authorizationUrl);
      const unique = name => { const values = url.searchParams.getAll(name); if (values.length !== 1) throw new Error(`Expected one ${name}.`); return values[0]; };
      const state = unique('state'), clientId = unique('client_id'), redirectUri = unique('redirect_uri'), audience = unique('resource');
      const challenge = unique('code_challenge');
      if (unique('response_type') !== 'code' || unique('code_challenge_method') !== 'S256' || unique('scope') !== 'openid' || url.searchParams.getAll('scope').length !== 1 || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) throw new Error('Authorization request did not use the registered PKCE public-client contract.');
      const code = randomUUID(); codes.set(code, {subject, clientId, redirectUri, audience, challenge, used: false});
      const callback = new URL(redirectUri); callback.searchParams.set('code', code); callback.searchParams.set('state', state);
      return callback.href;
    },
    revoke(value) { const record = tokens.get(value); if (record) record.active = false; },
    revokeSession(value) { const record = sessions.get(value); if (record) record.active = false; },
    async close() { await new Promise(resolve => server.close(resolve)); await rm(directory, {recursive: true, force: true}); },
    fetch: fetcher,
  };
}
