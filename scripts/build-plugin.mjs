import {createHash} from 'node:crypto';
import {cp, lstat, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  createPersonalMarketplaceManifest,
  createRegisteredAppManifest,
  TEMPLATE_REGISTERED_PLUGIN_ID,
  validateCloudMcpManifest,
  validateCloudPluginManifest,
  validateCloudPluginSettings,
  validateRegisteredAppManifest,
} from '../lib/mcp/cloud-plugin/config.mjs';
import {verifyPluginArtifact} from './testing/verify-plugin-artifact.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(repository, 'dist/plugin');
const source = resolve(repository, 'plugins/action-tools');
const settingsPath = parseConfigArgument(process.argv.slice(2));
const installable = settingsPath !== undefined;

function parseConfigArgument(args) {
  if (args.length === 0) return undefined;
  if (args.length !== 2 || args[0] !== '--config' || typeof args[1] !== 'string') {
    throw new Error('Usage: node scripts/build-plugin.mjs [--config .local/dist/action-tools/plugin-settings.json]');
  }
  const expected = resolve(repository, '.local/dist/action-tools/plugin-settings.json');
  if (resolve(args[1]) !== expected) throw new Error('Only the explicit private renderer output .local/dist/action-tools/plugin-settings.json can configure the package.');
  return expected;
}

async function listFiles(directory, base = directory) {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const full = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Personal plugin package cannot contain symbolic links: ${relative(base, full)}`);
    if (entry.isDirectory()) result.push(...await listFiles(full, base));
    else if (entry.isFile()) result.push(relative(base, full).split(sep).join('/'));
  }
  return result.sort();
}

const plugin = validateCloudPluginManifest(JSON.parse(await readFile(join(source, 'plugin.json'), 'utf8')));
const mcp = validateCloudMcpManifest(JSON.parse(await readFile(join(source, 'mcp.json'), 'utf8')));
const appTemplate = validateRegisteredAppManifest(JSON.parse(await readFile(join(source, '.app.json'), 'utf8')), {template: true});
const settings = installable
  ? validateCloudPluginSettings(JSON.parse(await readFile(settingsPath, 'utf8')))
  : undefined;
const app = settings ? createRegisteredAppManifest(settings.registeredPluginId) : appTemplate;
const marketplace = createPersonalMarketplaceManifest({installable});
const sharedHtml = resolve(repository, 'dist/spa/workspace.html');
await lstat(sharedHtml);

await rm(output, {recursive: true, force: true});
const packageRoot = join(output, 'syntoria-weave');
await mkdir(join(output, '.agents/plugins'), {recursive: true});
await mkdir(packageRoot, {recursive: true});
await writeFile(join(packageRoot, 'plugin.json'), `${JSON.stringify(plugin, null, 2)}\n`);
await writeFile(join(packageRoot, 'mcp.json'), `${JSON.stringify(mcp, null, 2)}\n`);
await writeFile(join(packageRoot, '.app.json'), `${JSON.stringify(app, null, 2)}\n`);
await writeFile(join(output, '.agents/plugins/marketplace.json'), `${JSON.stringify(marketplace, null, 2)}\n`);

await mkdir(join(packageRoot, 'resources'), {recursive: true});
await cp(sharedHtml, join(packageRoot, 'resources/actions-v4.html'));
await mkdir(join(packageRoot, 'skills'), {recursive: true});
for (const skill of ['action-guide', 'action-tools']) {
  const skillSource = resolve(repository, 'skills', skill);
  await cp(skillSource, join(packageRoot, 'skills', skill), {
    recursive: true,
    dereference: true,
    filter: sourcePath => !relative(skillSource, sourcePath).split(sep).includes('.local'),
  });
}
await cp(join(repository, 'LICENSE'), join(packageRoot, 'LICENSE'));

const files = await listFiles(output);
const inventory = [];
for (const path of files) {
  const contents = await readFile(join(output, path));
  inventory.push({path, bytes: contents.byteLength, sha256: createHash('sha256').update(contents).digest('hex')});
}
const artifactManifest = {
  format: 1,
  plugin: plugin.name,
  version: plugin.version,
  installable,
  ...(installable ? {registeredPluginId: app.apps.actions.id} : {registeredPluginId: TEMPLATE_REGISTERED_PLUGIN_ID}),
  files: inventory,
};
await writeFile(join(output, 'artifact-manifest.json'), `${JSON.stringify(artifactManifest, null, 2)}\n`);

const verified = await verifyPluginArtifact({artifact: output, sharedHtml});
process.stdout.write(`Built and verified ${verified.template ? 'noninstallable template' : 'configured personal install root'} at dist/plugin with ${verified.files} files, ${plugin.name} ${plugin.version}.\n`);
if (verified.template) process.stdout.write('Render the actual host-issued registered plugin ID before installing this package.\n');
