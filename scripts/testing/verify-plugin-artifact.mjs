import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  TEMPLATE_REGISTERED_PLUGIN_ID,
  validateCloudMcpManifest,
  validateCloudPluginManifest,
  validatePersonalMarketplaceManifest,
  validateRegisteredAppManifest,
  validateRegisteredPluginId,
} from '../../lib/mcp/cloud-plugin/config.mjs';

async function listFiles(directory, base = directory) {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const full = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Personal plugin artifact contains a symbolic link: ${relative(base, full)}`);
    if (entry.isDirectory()) result.push(...await listFiles(full, base));
    else if (entry.isFile()) result.push(relative(base, full).split(sep).join('/'));
  }
  return result.sort();
}

function allowedArtifactPath(path) {
  return path === 'artifact-manifest.json'
    || path === '.agents/plugins/marketplace.json'
    || path === 'syntoria-weave/.app.json'
    || path === 'syntoria-weave/LICENSE'
    || path === 'syntoria-weave/mcp.json'
    || path === 'syntoria-weave/plugin.json'
    || path === 'syntoria-weave/resources/actions-v4.html'
    || path.startsWith('syntoria-weave/skills/action-guide/')
    || path.startsWith('syntoria-weave/skills/action-tools/');
}

export async function verifyPluginArtifact({artifact, sharedHtml}) {
  const files = await listFiles(artifact);
  for (const path of files) {
    if (!allowedArtifactPath(path)) throw new Error(`Personal plugin artifact contains an unsupported file: ${path}`);
  }
  const requiredPaths = [
    '.agents/plugins/marketplace.json',
    'artifact-manifest.json',
    'syntoria-weave/.app.json',
    'syntoria-weave/LICENSE',
    'syntoria-weave/mcp.json',
    'syntoria-weave/plugin.json',
    'syntoria-weave/resources/actions-v4.html',
    'syntoria-weave/skills/action-guide/SKILL.md',
    'syntoria-weave/skills/action-tools/SKILL.md',
  ];
  const missingPaths = requiredPaths.filter(path => !files.includes(path));
  if (missingPaths.length > 0) throw new Error(`Personal plugin artifact is missing required files: ${missingPaths.join(', ')}.`);

  const packageRoot = join(artifact, 'syntoria-weave');
  const plugin = validateCloudPluginManifest(JSON.parse(await readFile(join(packageRoot, 'plugin.json'), 'utf8')));
  validateCloudMcpManifest(JSON.parse(await readFile(join(packageRoot, 'mcp.json'), 'utf8')));
  const app = JSON.parse(await readFile(join(packageRoot, '.app.json'), 'utf8'));
  const marketplace = JSON.parse(await readFile(join(artifact, '.agents/plugins/marketplace.json'), 'utf8'));
  const artifactManifest = JSON.parse(await readFile(join(artifact, 'artifact-manifest.json'), 'utf8'));
  if (artifactManifest.format !== 1 || artifactManifest.plugin !== plugin.name
    || artifactManifest.version !== plugin.version || typeof artifactManifest.installable !== 'boolean'
    || !Array.isArray(artifactManifest.files)) {
    throw new Error('Personal plugin artifact inventory has invalid identity or installability metadata.');
  }

  const template = artifactManifest.installable === false;
  validateRegisteredAppManifest(app, {template});
  const appId = app.apps.actions.id;
  if (artifactManifest.registeredPluginId !== appId) throw new Error('The artifact registered app ID does not match .app.json.');
  if (template && appId !== TEMPLATE_REGISTERED_PLUGIN_ID) {
    throw new Error('A noninstallable template must retain the explicit template-only app ID.');
  }
  if (!template) validateRegisteredPluginId(appId);
  validatePersonalMarketplaceManifest(marketplace, {installable: !template});

  const inventory = artifactManifest.files.map(item => item.path);
  const expectedInventory = files.filter(path => path !== 'artifact-manifest.json');
  if (inventory.join('\n') !== expectedInventory.join('\n')) {
    throw new Error('Personal plugin artifact inventory does not match the packaged files.');
  }
  for (const item of artifactManifest.files) {
    if (!item || typeof item.path !== 'string' || !Number.isSafeInteger(item.bytes) || typeof item.sha256 !== 'string') {
      throw new Error('Personal plugin artifact inventory contains an invalid file record.');
    }
    const contents = await readFile(join(artifact, item.path));
    const hash = createHash('sha256').update(contents).digest('hex');
    if (contents.byteLength !== item.bytes || hash !== item.sha256) {
      throw new Error(`Personal plugin artifact verification failed for ${item.path}.`);
    }
  }

  const packagedHtml = await readFile(join(packageRoot, 'resources/actions-v4.html'));
  const expectedHtml = await readFile(sharedHtml);
  if (!packagedHtml.equals(expectedHtml)) throw new Error('The packaged UI resource differs from the shared SPA widget bytes.');
  return {files: files.length, plugin: plugin.name, version: plugin.version, registeredPluginId: appId, template};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repository = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const artifact = resolve(repository, 'dist/plugin');
  const sharedHtml = resolve(repository, 'dist/spa/workspace.html');
  const result = await verifyPluginArtifact({artifact, sharedHtml});
  process.stdout.write(`Verified dist/plugin: ${result.files} files, ${result.plugin} ${result.version}, ${result.template ? 'noninstallable template' : 'configured ID ' + result.registeredPluginId}.\n`);
}
