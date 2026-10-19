import assert from 'node:assert/strict';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {
  createPersonalMarketplaceManifest,
  createRegisteredAppManifest,
  renderPersonalPluginSettings,
  TEMPLATE_REGISTERED_PLUGIN_ID,
  validateCloudMcpManifest,
  validateCloudPluginManifest,
  validateCloudPluginSettings,
  validatePersonalMarketplaceManifest,
  validateRegisteredAppManifest,
} from '../../lib/mcp/cloud-plugin/config.mjs';

const repository = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const plugin = JSON.parse(readFileSync(join(repository, 'plugins/action-tools/plugin.json'), 'utf8'));
const mcp = JSON.parse(readFileSync(join(repository, 'plugins/action-tools/mcp.json'), 'utf8'));
const settings = Object.freeze({
  issuer: 'https://identity.example.test',
  resourceEndpoint: 'https://api.example.test/mcp',
  registeredPluginId: 'plugin_asdk_app-test-registered-001',
});

test('personal plugin requires the Syntoria Weave registered app dependency', () => {
  assert.equal(validateCloudPluginManifest(plugin), plugin);
  assert.equal(plugin.name, 'syntoria-weave');
  assert.equal(plugin.version, '1.0.3');
  assert.equal(plugin.extensions['com.openai'].interface.displayName, 'Syntoria Weave');
  assert.equal(plugin.extensions['com.openai'].apps, './.app.json');
  assert.equal(Object.hasOwn(plugin.extensions['com.openai'], 'requires_local_executor'), false);
});

test('package MCP manifest has no server and cannot duplicate the registered app connection', () => {
  assert.equal(validateCloudMcpManifest(mcp), mcp);
  assert.deepEqual(mcp.mcpServers, {});
  const duplicate = structuredClone(mcp);
  duplicate.mcpServers['action-tools'] = {type: 'streamable-http', url: settings.resourceEndpoint};
  assert.throws(() => validateCloudMcpManifest(duplicate), /MCP servers must contain exactly/);
});

test('private renderer settings retain registration details and require the actual host ID', () => {
  assert.deepEqual(validateCloudPluginSettings(settings), settings);
  assert.deepEqual(renderPersonalPluginSettings(settings), settings);
  assert.throws(() => validateCloudPluginSettings({...settings, clientId: 'static-public-client'}), /exactly/);
  assert.throws(() => validateCloudPluginSettings({...settings, registeredPluginId: TEMPLATE_REGISTERED_PLUGIN_ID}), /host-issued/);
  assert.throws(() => validateCloudPluginSettings({...settings, registeredPluginId: 'invented-id'}), /host-issued/);
  assert.throws(() => validateCloudPluginSettings({...settings, registeredPluginId: undefined}), /host-issued/);
});

test('renderer settings reject secrets and reserved or local deployment endpoints', () => {
  assert.throws(() => validateCloudPluginSettings({...settings, clientSecret: 'secret'}), /exactly/);
  assert.throws(() => validateCloudPluginSettings({...settings, resourceEndpoint: 'http://api.example.test/mcp'}), /HTTPS/);
  assert.throws(() => validateCloudPluginSettings({...settings, resourceEndpoint: 'https://127.0.0.1/mcp'}), /loopback/);
  assert.throws(() => validateCloudPluginSettings({...settings, resourceEndpoint: 'https://api.example.invalid/mcp'}), /reserved example host/);
  assert.throws(() => validateCloudPluginSettings({...settings, issuer: 'https://identity.example.invalid'}), /reserved example host/);
});

test('registered app dependency is required and marketplace source resolves from its root', () => {
  const app = createRegisteredAppManifest(settings.registeredPluginId);
  assert.deepEqual(app.apps.actions, {id: settings.registeredPluginId, required: true});
  assert.equal(validateRegisteredAppManifest(app), app);
  assert.throws(() => validateRegisteredAppManifest({apps: {actions: {id: settings.registeredPluginId, required: false}}}), /required/);
  const template = createPersonalMarketplaceManifest({installable: false});
  assert.deepEqual(template.plugins, []);
  const configured = createPersonalMarketplaceManifest({installable: true});
  assert.equal(configured.plugins[0].source.path, './syntoria-weave');
  assert.equal(configured.plugins[0].name, 'syntoria-weave');
  assert.equal(validatePersonalMarketplaceManifest(configured, {installable: true}), configured);
});

test('renderer and package CLIs build a noninstallable template and a configured personal install root', t => {
  const root = mkdtempSync(join(tmpdir(), 'syntoria-weave-package-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const sources = [
    'scripts/render-plugin.mjs',
    'scripts/build-plugin.mjs',
    'scripts/testing/verify-plugin-artifact.mjs',
    'lib/mcp/cloud-plugin/config.mjs',
    'plugins/action-tools/.app.json',
    'plugins/action-tools/plugin.json',
    'plugins/action-tools/mcp.json',
    'skills/action-guide',
    'skills/action-tools',
    'LICENSE',
  ];
  for (const path of sources) {
    const destination = join(root, path);
    mkdirSync(dirname(destination), {recursive: true});
    cpSync(join(repository, path), destination, {recursive: true, dereference: true});
  }
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'syntoria-weave-command-fixture',
    private: true,
    packageManager: JSON.parse(readFileSync(join(repository, 'package.json'), 'utf8')).packageManager,
    scripts: {
      'render:plugin-config': 'node scripts/render-plugin.mjs',
      'build:plugin': 'node scripts/build-plugin.mjs',
      'verify:plugin': 'node scripts/testing/verify-plugin-artifact.mjs',
    },
  }));
  assert.equal(existsSync(join(root, 'skills/action-guide/SKILL.md')), true);
  assert.equal(existsSync(join(root, 'skills/action-tools/SKILL.md')), true);
  mkdirSync(join(root, 'dist/spa'), {recursive: true});
  writeFileSync(join(root, 'dist/spa/workspace.html'), '<main>shared UI fixture</main>');
  const run = args => spawnSync(process.execPath, args, {cwd: root, encoding: 'utf8'});
  const runPnpm = args => spawnSync('pnpm', args, {cwd: root, encoding: 'utf8'});

  const missingSettings = run(['scripts/render-plugin.mjs']);
  assert.notEqual(missingSettings.status, 0);
  assert.match(missingSettings.stderr, /Missing required option/);
  assert.equal(existsSync(join(root, '.local/dist/action-tools/plugin-settings.json')), false);

  const templateBuild = run(['scripts/build-plugin.mjs']);
  assert.equal(templateBuild.status, 0, templateBuild.stderr);
  assert.match(templateBuild.stdout, /noninstallable template/);
  const artifact = join(root, 'dist/plugin');
  const packageRoot = join(artifact, 'syntoria-weave');
  assert.deepEqual(JSON.parse(readFileSync(join(packageRoot, 'mcp.json'), 'utf8')).mcpServers, {});
  assert.equal(JSON.parse(readFileSync(join(packageRoot, '.app.json'), 'utf8')).apps.actions.id, TEMPLATE_REGISTERED_PLUGIN_ID);
  assert.deepEqual(JSON.parse(readFileSync(join(artifact, '.agents/plugins/marketplace.json'), 'utf8')).plugins, []);
  assert.equal(existsSync(join(packageRoot, 'skills/action-guide/SKILL.md')), true);
  assert.equal(existsSync(join(packageRoot, 'skills/action-tools/SKILL.md')), true);
  assert.equal(existsSync(join(packageRoot, 'LICENSE')), true);
  for (const forbidden of ['server.mjs', 'launcher.mjs', 'config.json', 'config.example.json']) {
    assert.equal(existsSync(join(packageRoot, forbidden)), false, `${forbidden} must not be packaged`);
  }

  const rendered = runPnpm([
    'render:plugin-config',
    '--issuer', settings.issuer,
    '--resource-endpoint', settings.resourceEndpoint,
    '--registered-plugin-id', settings.registeredPluginId,
  ]);
  assert.equal(rendered.status, 0, rendered.stderr);
  const settingsPath = join(root, '.local/dist/action-tools/plugin-settings.json');
  const renderedSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  assert.deepEqual(renderedSettings, settings);
  const configuredBuild = runPnpm(['build:plugin', '--config', '.local/dist/action-tools/plugin-settings.json']);
  assert.equal(configuredBuild.status, 0, configuredBuild.stderr);
  assert.match(configuredBuild.stdout, /configured personal install root/);
  const configuredApp = JSON.parse(readFileSync(join(packageRoot, '.app.json'), 'utf8'));
  assert.deepEqual(configuredApp.apps.actions, {id: settings.registeredPluginId, required: true});
  assert.deepEqual(JSON.parse(readFileSync(join(packageRoot, 'mcp.json'), 'utf8')).mcpServers, {});
  const marketplace = JSON.parse(readFileSync(join(artifact, '.agents/plugins/marketplace.json'), 'utf8'));
  assert.equal(marketplace.plugins.length, 1);
  assert.equal(marketplace.plugins[0].source.path, './syntoria-weave');
  assert.equal(marketplace.plugins[0].name, 'syntoria-weave');
  const verifiedConfiguredBuild = runPnpm(['verify:plugin']);
  assert.equal(verifiedConfiguredBuild.status, 0, verifiedConfiguredBuild.stderr);
  const artifactText = JSON.stringify(Object.fromEntries(
    ['artifact-manifest.json', '.agents/plugins/marketplace.json', 'syntoria-weave/.app.json', 'syntoria-weave/mcp.json', 'syntoria-weave/plugin.json']
      .map(path => [path, JSON.parse(readFileSync(join(artifact, path), 'utf8'))]),
  ));
  for (const value of [settings.issuer, settings.resourceEndpoint]) assert.equal(artifactText.includes(value), false);

  const fixedClientRenderer = runPnpm([
    'render:plugin-config',
    '--issuer', settings.issuer,
    '--resource-endpoint', settings.resourceEndpoint,
    '--client-id', 'static-public-client',
    '--registered-plugin-id', settings.registeredPluginId,
  ]);
  assert.notEqual(fixedClientRenderer.status, 0);
  assert.match(fixedClientRenderer.stderr, /Usage:/);

  writeFileSync(join(packageRoot, 'launcher.mjs'), 'process.exit(1);');
  const staleArtifact = run(['scripts/testing/verify-plugin-artifact.mjs']);
  assert.notEqual(staleArtifact.status, 0);
  assert.match(staleArtifact.stderr, /unsupported file: syntoria-weave\/launcher\.mjs/);
  rmSync(join(packageRoot, 'launcher.mjs'));
  writeFileSync(join(packageRoot, 'mcp.json'), `${JSON.stringify({...mcp, stale: true})}\n`);
  const changedArtifact = run(['scripts/testing/verify-plugin-artifact.mjs']);
  assert.notEqual(changedArtifact.status, 0);
});
