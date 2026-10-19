import {chmod, mkdir, open, readFile, rename, unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {renderPersonalPluginSettings, validateCloudPluginManifest, validateCloudMcpManifest} from '../lib/mcp/cloud-plugin/config.mjs';

const repository = resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = resolve(repository, 'plugins/action-tools');
const outputDirectory = resolve(repository, '.local/dist/action-tools');
const target = resolve(outputDirectory, 'plugin-settings.json');

function parseArguments(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (!['--issuer', '--resource-endpoint', '--registered-plugin-id'].includes(key)
      || values.has(key) || typeof args[index + 1] !== 'string') {
      throw new Error('Usage: node scripts/render-plugin.mjs --issuer <https-url> --resource-endpoint <https-url> --registered-plugin-id <plugin_asdk_app…>');
    }
    values.set(key, args[++index]);
  }
  for (const required of ['--issuer', '--resource-endpoint', '--registered-plugin-id']) {
    if (!values.has(required)) throw new Error(`Missing required option ${required}.`);
  }
  return {
    issuer: values.get('--issuer'),
    resourceEndpoint: values.get('--resource-endpoint'),
    registeredPluginId: values.get('--registered-plugin-id'),
  };
}

validateCloudPluginManifest(JSON.parse(await readFile(resolve(source, 'plugin.json'), 'utf8')));
validateCloudMcpManifest(JSON.parse(await readFile(resolve(source, 'mcp.json'), 'utf8')));
const settings = renderPersonalPluginSettings(parseArguments(process.argv.slice(2)));
const temporary = resolve(outputDirectory, `.plugin-settings.${randomUUID()}.tmp`);
await mkdir(outputDirectory, {recursive: true, mode: 0o700});
await chmod(outputDirectory, 0o700);
let handle;
try {
  handle = await open(temporary, 'wx', 0o600);
  await handle.writeFile(`${JSON.stringify(settings, null, 2)}\n`);
  await handle.sync();
  await handle.close();
  handle = undefined;
  await rename(temporary, target);
  await chmod(target, 0o600);
} catch (error) {
  await handle?.close().catch(() => {});
  await unlink(temporary).catch(() => {});
  throw error;
}
process.stdout.write(`Rendered private ChatGPT app dependency settings to ${target}.\n`);
