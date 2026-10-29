import {spawn, spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {createServer as createHttpServer} from 'node:http';
import {createServer as createNetServer} from 'node:net';
import {chmod, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, sep} from 'node:path';
import pg from 'pg';
import {createPool} from '../lib/adapters/postgres/pool.ts';
import {checkRuntime, grantRuntime, migrate} from '../lib/adapters/postgres/migrations.ts';
import {createIdentityStore} from '../lib/adapters/postgres/identity-store.ts';
import {createPostgresActionStore, cursorScope} from '../lib/adapters/postgres/action-store.ts';
import {actionCall} from '../lib/application/action-service.ts';
import {fail} from '../lib/domain/core.ts';
import {issuePrincipal, verifyPrincipal} from '../lib/server/node/principal.ts';
import {createServer} from '../lib/server/node/server.ts';
import {cookieValue, sessionCookie} from '../lib/server/node/authentication.ts';

const defaultPort = 5174;
const sessionToken = 'local-preview-session';
const csrfToken = randomBytes(24).toString('base64url');
const maxRequestBytes = 1_048_576;
const mediaTypes = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'], ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.svg', 'image/svg+xml'],
]);

function configuredPort(value = process.env.LOCAL_PREVIEW_PORT) {
  const port = value === undefined ? defaultPort : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('LOCAL_PREVIEW_PORT must be an integer from 1 through 65535.');
  return port;
}

async function availablePort() {
  const listener = createNetServer();
  await new Promise((resolveListen, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolveListen);
  });
  const port = listener.address().port;
  await new Promise(resolveClose => listener.close(resolveClose));
  return port;
}

function localShell(nonce) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local Actions</title><style>html,body{margin:0;height:100%;font:14px system-ui}body{display:flex;flex-direction:column}#notice{padding:8px 12px;color:#666;border-bottom:1px solid #ddd}#workspace{width:100%;flex:1;min-height:0;border:0}</style></head><body><div id="notice" role="status">Local preview. Data is temporary and deleted when this server stops.</div><iframe id="workspace" title="Actions"></iframe><script nonce="${nonce}">
const frame=document.querySelector('#workspace');let csrf=null,ready=false;
const linkTarget=value=>{if(typeof value!=='string')return null;try{const url=new URL(value);return ['http:','https:','mailto:'].includes(url.protocol)?url.href:null}catch{return null}};
async function start(){try{const response=await fetch('/api/session',{cache:'no-store'});if(!response.ok)throw new Error('Local session unavailable.');const session=await response.json();csrf=session.csrf_token;ready=typeof csrf==='string'&&csrf.length>0;if(!ready)throw new Error('Invalid local session.');frame.src='/workspace.html';}catch{document.querySelector('#notice').textContent='The local preview session could not start. Reload after checking the terminal.';}}
window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.origin!==location.origin||event.data?.jsonrpc!=='2.0')return;
 const call=event.data;if(!(typeof call.id==='string'||(typeof call.id==='number'&&Number.isFinite(call.id))))return;
 let result;
 if(call.method==='ui/initialize')result={protocolVersion:'2026-01-26',hostInfo:{name:'local-preview',version:'1'},hostCapabilities:{},hostContext:{displayMode:'fullscreen',availableDisplayModes:['fullscreen'],platform:'web'}};
 else if(call.method==='ui/request-display-mode')result={mode:'fullscreen'};
 else if(call.method==='ui/open-link'){const url=linkTarget(call.params?.url);if(url)window.open(url,'_blank','noopener,noreferrer');result=url?{}:{isError:true};}
 else if(call.method==='tools/call'){
  if(!ready)result={isError:true,structuredContent:{error:{code:'unauthenticated',message:'The local preview session is unavailable.'}}};
  else try{const response=await fetch('/api/actions',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(call.params)});const data=await response.json();result=response.ok?{structuredContent:data}:{isError:true,structuredContent:{error:{code:data.error??'outcome_unknown',message:data.message??'The local request failed.'}}};}
  catch{result={isError:true,structuredContent:{error:{code:'outcome_unknown',message:'Retain the exact request and check its result.'}}};}
 }else return;
 frame.contentWindow.postMessage({jsonrpc:'2.0',id:call.id,result},location.origin);
});
void start();
</script></body></html>`;
}

function rejectDuplicateHeaders(rawHeaders) {
  const unique = new Set(['host', 'origin', 'content-type', 'x-csrf-token', 'authorization']);
  const seen = new Set();
  for (let index = 0; index < rawHeaders.length; index += 2) {
    const name = rawHeaders[index].toLowerCase();
    if (!unique.has(name)) continue;
    if (seen.has(name)) return name;
    seen.add(name);
  }
  return null;
}

function contentTypeIsJson(value) {
  return typeof value === 'string' && value.split(';', 1)[0].trim().toLowerCase() === 'application/json';
}

async function requestBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxRequestBytes) throw Object.assign(new Error('Request is too large.'), {statusCode: 413});
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sendError(response, status, message) {
  response.writeHead(status, {'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff'});
  response.end(JSON.stringify({error: status === 413 ? 'operation_too_large' : 'forbidden', message}));
}

function createSyntheticAuthentication(config, identityStore, binding) {
  const scopes = ['state:read', 'state:write'];
  async function principal() {
    const identity = await identityStore.resolveSubject(binding);
    return issuePrincipal({...binding, user: identity.user, clientId: config.browserClientId, connectionId: 'local-preview', actorKind: 'user', scopes});
  }
  return Object.freeze({
    async authenticate(headers, write = false) {
      if (headers.authorization !== undefined) fail('unauthenticated', 'Bearer credentials are unavailable in local preview.', 401);
      const token = cookieValue(headers.cookie, sessionCookie);
      if (token !== sessionToken) fail('unauthenticated', 'Local preview session is invalid.', 401);
      if (write && (headers.origin !== config.origin || headers.csrf !== csrfToken)) fail('forbidden', 'Local writes require the preview origin and CSRF token.', 403);
      return principal();
    },
    async revalidate(identity, client) {
      const verified = verifyPrincipal(identity);
      if (verified.issuer !== binding.issuer || verified.subject !== binding.subject || verified.clientId !== config.browserClientId || verified.connectionId !== 'local-preview') fail('unauthenticated', 'Local preview identity changed.', 401);
      const current = await identityStore.resolveSubject(binding, client);
      if (current.user !== verified.user) fail('forbidden', 'Local preview identity is unavailable.', 403);
    },
    sessionInfo(identity) {
      const verified = verifyPrincipal(identity);
      return {account_scope: createHash('sha256').update('account\0' + verified.user).digest('hex'), csrf_token: csrfToken};
    },
  });
}

async function startDatabase() {
  const directory = await mkdtemp(join(tmpdir(), 'action-local-preview-'));
  let processHandle, admin, runtime;
  let closing = false;
  let postgresReady = false;
  try {
    const binaries = await (await import(new URL('./binary.js', import.meta.resolve('embedded-postgres')))).default();
    await chmod(binaries.initdb, 0o755);
    await chmod(binaries.postgres, 0o755);
    const password = randomUUID().replaceAll('-', '');
    const passwordFile = join(directory, 'password');
    const dataDirectory = join(directory, 'db');
    await writeFile(passwordFile, password, {mode: 0o600});
    const init = spawnSync(binaries.initdb, ['-D', dataDirectory, '-U', 'postgres', '--auth=scram-sha-256', '--pwfile=' + passwordFile, '--locale=C'], {encoding: 'utf8', env: {LC_ALL: 'C'}});
    if (init.status !== 0) throw new Error('Local PostgreSQL initialization failed: ' + (init.stderr || init.error?.message || 'unknown error'));

    const port = await availablePort();
    processHandle = spawn(binaries.postgres, ['-D', dataDirectory, '-h', '127.0.0.1', '-p', String(port), '-k', directory], {env: {LC_ALL: 'C'}, stdio: ['ignore', 'ignore', 'pipe']});
    await new Promise((resolveReady, reject) => {
      const timer = setTimeout(() => reject(new Error('Local PostgreSQL startup timed out.')), 15_000);
      processHandle.once('error', error => { clearTimeout(timer); reject(error); });
      processHandle.once('exit', code => { if (!postgresReady) { clearTimeout(timer); reject(new Error('Local PostgreSQL exited before readiness (code ' + code + ').')); } });
      processHandle.stderr.on('data', chunk => {
        if (chunk.toString().includes('ready to accept connections')) {
          postgresReady = true;
          clearTimeout(timer);
          resolveReady();
        }
      });
    });
    const adminUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`;
    admin = new pg.Pool({connectionString: adminUrl, max: 3, connectionTimeoutMillis: 3000});
    const migrations = resolve('db/postgres/migrations');
    await migrate(admin, migrations);
    await admin.query(`CREATE ROLE action_runtime LOGIN PASSWORD '${password}'`);
    await grantRuntime(admin, 'action_runtime');
    const binding = {issuer: 'urn:action-tools:local-preview', subject: randomUUID()};
    const userId = randomUUID();
    await admin.query('INSERT INTO identity.subjects(issuer,subject,user_id,enabled) VALUES($1,$2,$3,true)', [binding.issuer, binding.subject, userId]);
    await admin.end();
    admin = undefined;
    const url = `postgresql://action_runtime:${password}@127.0.0.1:${port}/postgres`;
    runtime = createPool(url, {local: true, max: 5});
    await checkRuntime(runtime);
    return {directory, password, port, processHandle, runtime, binding, async close() {
      if (closing) return;
      closing = true;
      await runtime.end();
      if (processHandle.exitCode === null && processHandle.signalCode === null) {
        const exited = once(processHandle, 'exit');
        processHandle.kill('SIGINT');
        await Promise.race([exited, new Promise(resolveExit => setTimeout(resolveExit, 3_000))]);
        if (processHandle.exitCode === null && processHandle.signalCode === null) processHandle.kill('SIGKILL');
      }
      await rm(directory, {recursive: true, force: true});
    }};
  } catch (error) {
    await runtime?.end().catch(() => {});
    await admin?.end().catch(() => {});
    if (processHandle && processHandle.exitCode === null && processHandle.signalCode === null) {
      processHandle.kill('SIGINT');
      await Promise.race([once(processHandle, 'exit'), new Promise(resolveExit => setTimeout(resolveExit, 3_000))]);
      if (processHandle.exitCode === null && processHandle.signalCode === null) processHandle.kill('SIGKILL');
    }
    await rm(directory, {recursive: true, force: true});
    throw error;
  }
}

export function createLocalPreviewServer({api, workspace, origin, staticRoot = resolve('dist/spa')}) {
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.protocol !== 'http:' || parsedOrigin.hostname !== 'localhost' || parsedOrigin.pathname !== '/' || parsedOrigin.search || parsedOrigin.hash || parsedOrigin.username || parsedOrigin.password || parsedOrigin.origin !== origin) {
    throw new Error('Local preview origin must be an exact localhost HTTP origin.');
  }
  const host = parsedOrigin.host;
  return createHttpServer(async (request, response) => {
    try {
      if (request.headers.host !== host) return sendError(response, 403, 'Local preview accepts only its localhost origin.');
      const duplicate = rejectDuplicateHeaders(request.rawHeaders);
      if (duplicate) return sendError(response, 400, 'Duplicate ' + duplicate + ' header.');
      const url = new URL(request.url ?? '/', origin);
      if (url.pathname === '/api/session' || url.pathname === '/api/actions') {
        const expectedMethod = url.pathname === '/api/session' ? 'GET' : 'POST';
        if (request.method !== expectedMethod) return sendError(response, 405, 'Unsupported local preview method.');
        const requestOrigin = request.headers.origin;
        if (requestOrigin !== undefined && requestOrigin !== origin) return sendError(response, 403, 'Local preview rejects cross-origin requests.');
        if (url.pathname === '/api/actions' && (requestOrigin !== origin || !contentTypeIsJson(request.headers['content-type']))) return sendError(response, 403, 'Local writes require the localhost origin and JSON content type.');
        const payload = request.method === 'POST' ? await requestBody(request) : undefined;
        const headers = {host, cookie: sessionCookie + '=' + sessionToken};
        if (requestOrigin !== undefined) headers.origin = requestOrigin;
        if (request.headers['content-type'] !== undefined) headers['content-type'] = request.headers['content-type'];
        if (request.headers['x-csrf-token'] !== undefined) headers['x-csrf-token'] = request.headers['x-csrf-token'];
        if (request.headers.authorization !== undefined) headers.authorization = request.headers.authorization;
        const result = await api.inject({method: request.method, url: request.url, headers, payload});
        response.writeHead(result.statusCode, {'cache-control': 'no-store', 'content-type': result.headers['content-type'] ?? 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff'});
        return response.end(result.rawPayload);
      }
      if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/') {
        const nonce = randomBytes(18).toString('base64url');
        const body = Buffer.from(localShell(nonce));
        response.writeHead(200, {'cache-control': 'no-store', 'content-security-policy': `default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; frame-src 'self'; connect-src 'self'`, 'content-type': 'text/html; charset=utf-8', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY'});
        return response.end(request.method === 'HEAD' ? undefined : body);
      }
      if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/workspace.html') {
        response.writeHead(200, {'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:", 'content-type': 'text/html; charset=utf-8', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-frame-options': 'SAMEORIGIN'});
        return response.end(request.method === 'HEAD' ? undefined : workspace);
      }
      // Never expose copied runtime settings or other files from deployment output.
      if (url.pathname === '/runtime-config.json') return sendError(response, 404, 'Local preview does not serve deployment configuration.');
      const relative = decodeURIComponent(url.pathname);
      const path = resolve(staticRoot, '.' + relative);
      if ((request.method === 'GET' || request.method === 'HEAD') && path.startsWith(staticRoot + sep) && path !== resolve(staticRoot, 'runtime-config.json')) {
        const extension = path.slice(path.lastIndexOf('.'));
        const contentType = mediaTypes.get(extension);
        if (contentType) {
          const file = await readFile(path);
          response.writeHead(200, {'cache-control': 'no-store', 'content-type': contentType, 'x-content-type-options': 'nosniff'});
          return response.end(request.method === 'HEAD' ? undefined : file);
        }
      }
      sendError(response, 404, 'Local preview resource not found.');
    } catch (error) {
      sendError(response, Number.isInteger(error?.statusCode) ? error.statusCode : 503, 'Local preview request failed.');
    }
  });
}

async function main() {
  const port = configuredPort();
  const origin = `http://localhost:${port}`;
  const workspacePath = resolve('dist/spa/workspace.html');
  let workspace;
  try { workspace = await readFile(workspacePath); }
  catch { throw new Error('Built local UI is missing. Run `pnpm build` before `pnpm dev`.'); }
  const database = await startDatabase();
  const config = Object.freeze({
    origin, issuer: 'urn:action-tools:local-preview', resource: origin + '/mcp', browserClientId: 'local-preview',
    spaOrigins: Object.freeze([origin]), sharedCookieDomain: 'localhost', gateClientId: 'local-preview', gateClientSecret: 'unused',
    databaseUrl: `postgresql://action_runtime:${database.password}@127.0.0.1:${database.port}/postgres`,
    cursorEpoch: randomUUID(), writeMode: 'enabled', clientWriteApproval: 'auto', port, localDatabase: true,
  });
  const identityStore = createIdentityStore(database.runtime);
  const authentication = createSyntheticAuthentication(config, identityStore, database.binding);
  const api = createServer({config, authentication, log: () => {}, invoke: (identity, name, args, signal, observe) => actionCall({
    store: createPostgresActionStore(database.runtime, identity, {revalidate: client => authentication.revalidate(identity, client), signal, observe}),
    clock: () => new Date().toISOString(), newId: randomUUID,
    changeCursorScope: async () => cursorScope(identity.user, config.cursorEpoch),
  }, name, args)});
  const server = createLocalPreviewServer({api, workspace, origin});

  let stopping = false;
  const closeHttpServer = () => new Promise(resolveClose => {
    if (!server.listening) return resolveClose();
    server.close(() => resolveClose());
  });
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await closeHttpServer();
    await api.close();
    await database.close();
    process.stdout.write('Local preview stopped; temporary database removed.\n');
  };
  process.once('SIGINT', () => { void shutdown().finally(() => process.exit(0)); });
  process.once('SIGTERM', () => { void shutdown().finally(() => process.exit(0)); });
  try {
    await new Promise((resolveListen, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolveListen);
    });
  } catch (error) {
    await api.close().catch(() => {});
    await database.close();
    throw error;
  }
  process.stdout.write(`Interactive local preview: ${origin}\n`);
  process.stdout.write('Synthetic identity and PostgreSQL are private to this run; all data is deleted on shutdown.\n');
}

if (process.argv[1] && import.meta.url === new URL('file://' + resolve(process.argv[1])).href) await main();
