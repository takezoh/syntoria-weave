import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {cp, lstat, mkdtemp, readFile, readdir, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const repository = resolve(new URL('../..', import.meta.url).pathname);
const plugin = resolve(repository, 'dist/plugin');
const temporaryRoot = await mkdtemp(join(tmpdir(), 'action-tools-package-'));
const copied = join(temporaryRoot, 'fresh-install');

async function listFiles(directory, base = directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const full = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symbolic link in package: ${full}`);
    if (entry.isDirectory()) files.push(...await listFiles(full, base));
    else if (entry.isFile()) files.push(full.slice(base.length + 1).split('\\').join('/'));
  }
  return files.sort();
}

try {
  assert.equal((await stat(join(plugin, 'launcher.mjs'))).isFile(), true, 'build dist/plugin before running this verifier');
  const artifact = JSON.parse(await readFile(join(plugin, 'artifact-manifest.json'), 'utf8'));
  assert.equal(artifact.format, 1);
  assert.equal(artifact.plugin, 'syntoria-weave');
  const pluginManifest = JSON.parse(await readFile(join(plugin, 'plugin.json'), 'utf8'));
  assert.equal(pluginManifest.name, 'syntoria-weave');
  assert.equal(pluginManifest.extensions['com.openai'].interface.displayName, 'Syntoria Weave');
  for (const file of artifact.files) {
    const bytes = await readFile(join(plugin, file.path));
    assert.equal(bytes.byteLength, file.bytes, `artifact byte size: ${file.path}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `artifact hash: ${file.path}`);
  }

  const files = await listFiles(plugin);
  assert(files.includes('plugin.json'));
  assert(files.includes('mcp.json'));
  assert(files.includes('server.mjs'));
  assert(files.includes('resources/actions-v4.html'));
  assert(files.includes('skills/action-tools/SKILL.md'));
  assert(!files.some(file => file === 'config.json' || file.includes('node_modules/') || file.startsWith('src/')));
  const packagedUi = await readFile(join(plugin, 'resources/actions-v4.html'));
  const spaUi = await readFile(resolve(repository, 'dist/spa/workspace.html'));
  assert(packagedUi.equals(spaUi), 'packaged UI bytes must equal the SPA widget resource');

  await cp(plugin, copied, {recursive: true, errorOnExist: true});
  const sourceFreeBundle = await readFile(join(copied, 'server.mjs'), 'utf8');
  const externalImports = [...sourceFreeBundle.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)]
    .map(match => match[1]).filter(specifier => !specifier.startsWith('node:'));
  assert.deepEqual(externalImports, [], 'the fresh package must not need repository imports or node_modules');

  const requests = [
    {jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-11-25'}},
    {jsonrpc: '2.0', id: 2, method: 'tools/list'},
    {jsonrpc: '2.0', id: 3, method: 'resources/read', params: {uri: 'ui://action-tools/actions-v4.html'}},
    {jsonrpc: '2.0', id: 4, method: 'tools/call', params: {name: 'get_connection_status', arguments: {}}},
    {jsonrpc: '2.0', id: 5, method: 'tools/call', params: {name: 'connect_action_service', arguments: {}}},
  ];
  const input = requests.map(request => JSON.stringify(request)).join('\n') + '\n';
  const child = spawnSync(process.execPath, [join(copied, 'launcher.mjs')], {
    cwd: copied,
    input,
    encoding: 'utf8',
    timeout: 15_000,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      ACTION_DATA_TOKEN: 'must-not-be-inherited',
      GITHUB_TOKEN: 'must-not-be-inherited',
      DATABASE_URL: 'must-not-be-inherited',
      OAI_AUTHENTICATED_USER_ID: 'must-not-be-inherited',
    },
  });
  assert.equal(child.status, 0, child.stderr);
  assert(!child.stdout.includes('must-not-be-inherited'));
  assert(!child.stderr.includes('must-not-be-inherited'));
  const replies = child.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(replies.length, requests.length);
  assert.equal(replies[0].result.serverInfo.name, 'action-tools-local');
  assert(replies[1].result.tools.some(tool => tool.name === 'list_actions'));
  assert(replies[1].result.tools.some(tool => tool.name === 'connect_action_service'));
  const openActions = replies[1].result.tools.find(tool => tool.name === 'open_actions');
  assert.equal(openActions.title, 'Syntoria Weave');
  assert.deepEqual(openActions._meta['openai/ui'].entrypoints, [{type: 'global'}, {type: 'thread'}]);
  assert.deepEqual(replies[1].result.tools.filter(tool => tool._meta?.['openai/ui']?.entrypoints?.some(entry => entry.type === 'global')).map(tool => tool.name), ['open_actions']);
  assert.equal(openActions._meta['openai/outputTemplate'], 'ui://action-tools/actions-v4.html');
  const uiResource = replies[2].result.contents[0];
  assert.equal(uiResource.text, packagedUi.toString('utf8'));
  assert.deepEqual(uiResource._meta['openai/ui'].availableDisplayModes, ['inline', 'fullscreen']);
  assert.equal(uiResource._meta['openai/widgetDescription'], 'Structured actions: normal, deferred, completed, details and safe editing.');
  assert.equal(replies[3].result.structuredContent.configured, false);
  assert.equal(replies[3].result.structuredContent.configurationError.code, 'configuration_required');
  assert.equal(replies[4].result.isError, true);
  assert.equal(replies[4].result.structuredContent.error.code, 'configuration_required');
  assert(!child.stdout.includes('ExperimentalWarning'), 'Node warnings must not pollute JSON-RPC stdout');

  const config = {issuer: 'https://gate.example.invalid', resourceEndpoint: 'https://api.example.invalid/mcp', clientId: 'action-tools-client'};
  await writeFile(join(copied, 'config.json'), JSON.stringify(config), {mode: 0o600});
  const pluginData = join(temporaryRoot, 'plugin-data');
  const configuredRequests = [
    {jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-11-25'}},
    {jsonrpc: '2.0', id: 2, method: 'tools/call', params: {name: 'get_connection_status', arguments: {}}},
  ];
  const configuredChild = spawnSync(process.execPath, [join(copied, 'launcher.mjs')], {
    cwd: copied,
    input: configuredRequests.map(request => JSON.stringify(request)).join('\n') + '\n',
    encoding: 'utf8',
    timeout: 15_000,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      PLUGIN_DATA: pluginData,
      ACTION_DATA_TOKEN: 'must-not-be-inherited',
      GITHUB_TOKEN: 'must-not-be-inherited',
      DATABASE_URL: 'must-not-be-inherited',
      OAI_AUTHENTICATED_USER_ID: 'must-not-be-inherited',
    },
  });
  assert.equal(configuredChild.status, 0, configuredChild.stderr);
  const configuredReplies = configuredChild.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(configuredReplies.length, configuredRequests.length);
  assert.deepEqual(configuredReplies[1].result.structuredContent, {configured: true, connected: false, credentialState: 'missing', serviceAcceptance: 'not_connected'});
  assert.equal((await stat(pluginData)).mode & 0o777, 0o700);
  assert.equal((await lstat(join(pluginData, 'authorization.sqlite'))).mode & 0o777, 0o600);
  assert(!configuredChild.stdout.includes('must-not-be-inherited'));
  assert(!configuredChild.stderr.includes('must-not-be-inherited'));
  assert(!configuredChild.stdout.includes('ExperimentalWarning'), 'Node warnings must not pollute JSON-RPC stdout');

  process.stdout.write('passed: hashed fresh package, shared UI byte equality, clean Node 24 launcher, JSON-RPC-only stdout, missing-config recovery, PLUGIN_DATA-only private state, and environment isolation\n');
} finally {
  await rm(temporaryRoot, {recursive: true, force: true});
}
