import assert from 'node:assert/strict';
import {createServer as createNetServer} from 'node:net';
import http from 'node:http';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {createLocalPreviewServer} from '../../scripts/local-preview.mjs';

async function freePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const {port} = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

function request(port, path, {method = 'GET', host = `localhost:${port}`, headers = {}, body} = {}) {
  return new Promise((resolve, reject) => {
    const value = http.request({hostname: '127.0.0.1', port, path, method, headers: {host, ...headers}}, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString('utf8')}));
    });
    value.once('error', reject);
    value.end(body);
  });
}

test('local preview HTTP bridge isolates its synthetic identity and enforces localhost write boundaries', async () => {
  const port = await freePort(), origin = `http://localhost:${port}`, csrf = 'local-preview-csrf';
  const staticRoot = await mkdtemp(join(tmpdir(), 'action-preview-http-'));
  await writeFile(join(staticRoot, 'runtime-config.json'), JSON.stringify({apiOrigin: 'https://production.example'}));
  let revision = 0, actions = [];
  const forwarded = [];
  const api = {async inject(input) {
    forwarded.push(input);
    if (input.url.startsWith('/api/session')) return {statusCode: 200, headers: {'content-type': 'application/json'}, rawPayload: JSON.stringify({account_scope: 'local-user', csrf_token: csrf})};
    const body = JSON.parse(input.payload.toString());
    if (input.headers.origin !== origin || input.headers['x-csrf-token'] !== csrf) return {statusCode: 403, headers: {'content-type': 'application/json'}, rawPayload: JSON.stringify({error: 'forbidden'})};
    if (body.name === 'add_action') { actions.push({id: 'local-1', title: body.arguments.title}); revision += 1; }
    return {statusCode: 200, headers: {'content-type': 'application/json'}, rawPayload: JSON.stringify({revision, actions})};
  }};
  const server = createLocalPreviewServer({api, workspace: Buffer.from('<main>shared widget</main>'), origin, staticRoot});
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    const shell = await request(port, '/');
    assert.equal(shell.status, 200);
    assert.match(shell.headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.match(shell.body, /Local preview\. Data is temporary/);
    assert.doesNotMatch(shell.body, /src="\/workspace\.html"/);
    assert.equal((await request(port, '/workspace.html')).body, '<main>shared widget</main>');
    assert.equal((await request(port, '/runtime-config.json')).status, 404);
    const session = await request(port, '/api/session', {headers: {cookie: '__Secure-gate_session=production-value'}});
    assert.equal(session.status, 200);
    assert.equal(JSON.parse(session.body).csrf_token, csrf);
    assert.equal(forwarded.at(-1).headers.cookie, '__Secure-gate_session=local-preview-session');

    const payload = JSON.stringify({name: 'add_action', arguments: {title: 'Persisted in local preview'}});
    const blockedOrigin = await request(port, '/api/actions', {method: 'POST', headers: {'content-type': 'application/json', origin: 'http://attacker.example', 'x-csrf-token': csrf}, body: payload});
    assert.equal(blockedOrigin.status, 403);
    const missingCsrf = await request(port, '/api/actions', {method: 'POST', headers: {'content-type': 'application/json', origin, 'x-csrf-token': 'wrong'}, body: payload});
    assert.equal(missingCsrf.status, 403);
    const invalidType = await request(port, '/api/actions', {method: 'POST', headers: {'content-type': 'text/plain', origin, 'x-csrf-token': csrf}, body: payload});
    assert.equal(invalidType.status, 403);
    assert.equal((await request(port, '/', {host: 'attacker.example'})).status, 403);

    const saved = await request(port, '/api/actions', {method: 'POST', headers: {'content-type': 'application/json', origin, 'x-csrf-token': csrf}, body: payload});
    assert.equal(saved.status, 200);
    assert.equal(JSON.parse(saved.body).revision, 1);
    const reloaded = await request(port, '/api/actions', {method: 'POST', headers: {'content-type': 'application/json', origin, 'x-csrf-token': csrf}, body: JSON.stringify({name: 'list_actions', arguments: {}})});
    assert.deepEqual(JSON.parse(reloaded.body).actions, [{id: 'local-1', title: 'Persisted in local preview'}]);
    assert.equal(JSON.parse(reloaded.body).revision, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(staticRoot, {recursive: true, force: true});
  }
});
