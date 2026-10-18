import {createHash} from 'node:crypto';
import {chmod, cp, lstat, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadLocalConfiguration} from '../lib/mcp/local/config.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(repository, 'dist/plugin');
const source = resolve(repository, 'plugins/action-tools');
const skillSource = resolve(repository, 'skills/action-tools');
const configPath = parseConfigArgument(process.argv.slice(2));

function parseConfigArgument(args) {
  if (args.length === 0) return undefined;
  if (args.length !== 2 || args[0] !== '--config' || typeof args[1] !== 'string') {
    throw new Error('Usage: node scripts/build-plugin.mjs [--config .local/dist/action-tools/config.json]');
  }
  const expected = resolve(repository, '.local/dist/action-tools/config.json');
  if (resolve(args[1]) !== expected) throw new Error('Only the explicit renderer output .local/dist/action-tools/config.json can be added to the package.');
  return expected;
}

function assertPrivateOutputPath(root, candidate, label) {
  const path = resolve(candidate);
  const suffix = relative(resolve(root), path);
  if (suffix === '' || (suffix !== '..' && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix))) {
    throw new Error(`${label} must be outside the distributable plugin directory.`);
  }
}

async function copyBundledLicenses(destination) {
  const require = createRequire(import.meta.url);
  const openIdRequire = createRequire(require.resolve('openid-client/package.json'));
  const packages = [
    ['openid-client', require.resolve('openid-client/package.json')],
    ['jose', require.resolve('jose/package.json')],
    ['oauth4webapi', openIdRequire.resolve('oauth4webapi/package.json')],
  ];
  for (const [name, packageJson] of packages) {
    const packageRoot = dirname(packageJson);
    const manifest = JSON.parse(await readFile(packageJson, 'utf8'));
    const licensePath = ['LICENSE.md', 'LICENSE', 'LICENCE.md', 'LICENCE'].map(candidate => join(packageRoot, candidate));
    let text;
    for (const candidate of licensePath) {
      try { text = await readFile(candidate); break; } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    }
    if (!text) throw new Error(`No license text was found for bundled dependency ${name}.`);
    const target = join(destination, `${name}.txt`);
    await writeFile(target, `Dependency: ${name}\nLicense: ${manifest.license ?? 'see included text'}\n\n`);
    await writeFile(target, text, {flag: 'a'});
  }
}

async function listFiles(directory, base = directory) {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const full = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Plugin package cannot contain symbolic links: ${relative(base, full)}`);
    if (entry.isDirectory()) result.push(...await listFiles(full, base));
    else if (entry.isFile()) result.push(relative(base, full).split(sep).join('/'));
  }
  return result.sort();
}

async function validateManifest() {
  const plugin = JSON.parse(await readFile(join(source, 'plugin.json'), 'utf8'));
  const mcp = JSON.parse(await readFile(join(source, 'mcp.json'), 'utf8'));
  if (plugin.$schema !== 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json' || plugin.name !== 'syntoria-weave' || plugin.extensions?.['com.openai']?.requires_local_executor !== true) {
    throw new Error('The portable plugin manifest is missing its Agent Plugins schema, plugin identity, or local-executor metadata.');
  }
  const server = mcp.mcpServers?.['action-tools'];
  if (mcp.$schema !== 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json' || server?.type !== 'stdio' || server.command !== 'node' || server.args?.[0] !== '${PLUGIN_ROOT}/launcher.mjs') {
    throw new Error('The portable MCP manifest must start the local launcher using the PLUGIN_ROOT placeholder.');
  }
  return {plugin, mcp};
}

const {plugin, mcp} = await validateManifest();
const sourceExample = JSON.parse(await readFile(join(source, 'config.example.json'), 'utf8'));
if (sourceExample.clientId !== 'action-tools-client' || !sourceExample.issuer.endsWith('.invalid') || !sourceExample.resourceEndpoint.endsWith('.invalid/mcp')) {
  throw new Error('The source example must use generic client and reserved .invalid endpoint identifiers.');
}

const bundledServer = resolve(repository, 'dist/local/server.mjs');
const sharedHtml = resolve(repository, 'dist/spa/workspace.html');
await lstat(bundledServer);
await lstat(sharedHtml);
const bundleText = await readFile(bundledServer, 'utf8');
const externalImports = [...bundleText.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)].map(match => match[1]).filter(specifier => !specifier.startsWith('node:'));
if (externalImports.length) throw new Error(`The distributable server has non-Node external imports: ${[...new Set(externalImports)].join(', ')}`);

if (configPath) {
  const config = await loadLocalConfiguration(configPath);
  if (config.dataDirectory) assertPrivateOutputPath(output, config.dataDirectory, 'Configured token data directory');
}

await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true, mode: 0o755});
await writeFile(join(output, 'plugin.json'), `${JSON.stringify(plugin, null, 2)}\n`);
await writeFile(join(output, 'mcp.json'), `${JSON.stringify(mcp, null, 2)}\n`);
await writeFile(join(output, 'config.example.json'), `${JSON.stringify(sourceExample, null, 2)}\n`);
await cp(join(source, 'launcher.mjs'), join(output, 'launcher.mjs'));
await cp(bundledServer, join(output, 'server.mjs'));
await mkdir(join(output, 'resources'), {recursive: true});
await cp(sharedHtml, join(output, 'resources/actions-v4.html'));
await mkdir(join(output, 'skills'), {recursive: true});
await cp(skillSource, join(output, 'skills/action-tools'), {recursive: true, filter: sourcePath => !sourcePath.includes(`${sep}.local${sep}`)});
await mkdir(join(output, 'licenses'), {recursive: true});
await cp(join(repository, 'LICENSE'), join(output, 'licenses/action-tools-MIT.txt'));
await copyBundledLicenses(join(output, 'licenses'));
if (configPath) {
  await cp(configPath, join(output, 'config.json'));
  await chmod(join(output, 'config.json'), 0o600);
}

const files = await listFiles(output);
const manifest = [];
for (const path of files) {
  const contents = await readFile(join(output, path));
  manifest.push({path, bytes: contents.byteLength, sha256: createHash('sha256').update(contents).digest('hex')});
}
const artifactManifest = {format: 1, plugin: plugin.name, version: plugin.version, files: manifest};
await writeFile(join(output, 'artifact-manifest.json'), `${JSON.stringify(artifactManifest, null, 2)}\n`);
for (const item of manifest) {
  const contents = await readFile(join(output, item.path));
  const digest = createHash('sha256').update(contents).digest('hex');
  if (contents.byteLength !== item.bytes || digest !== item.sha256) throw new Error(`Plugin artifact verification failed for ${item.path}.`);
}
const html = await readFile(join(output, 'resources/actions-v4.html'));
const sourceHtml = await readFile(sharedHtml);
if (!html.equals(sourceHtml)) throw new Error('The packaged UI resource differs from the shared SPA widget bytes.');
process.stdout.write(`Built dist/plugin with ${files.length} hashed files${configPath ? ' and explicit operator config' : ''}.\n`);
