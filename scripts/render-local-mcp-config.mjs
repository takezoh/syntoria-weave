import {chmod, mkdir, open, rename, unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {validateLocalConfiguration} from '../lib/mcp/local/config.mjs';

function parseArguments(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (!['--issuer', '--resource-endpoint', '--data-directory'].includes(key) || values.has(key) || typeof args[index + 1] !== 'string') {
      throw new Error('Usage: node scripts/render-local-mcp-config.mjs --issuer <https-url> --resource-endpoint <https-url> [--data-directory <absolute-private-path>]');
    }
    values.set(key, args[++index]);
  }
  for (const required of ['--issuer', '--resource-endpoint']) {
    if (!values.has(required)) throw new Error(`Missing required option ${required}.`);
  }
  return {
    issuer: values.get('--issuer'),
    resourceEndpoint: values.get('--resource-endpoint'),
    ...(values.has('--data-directory') ? {dataDirectory: values.get('--data-directory')} : {}),
  };
}

const configuration = validateLocalConfiguration(parseArguments(process.argv.slice(2)));
const outputDirectory = resolve('.local/local-mcp');
const target = resolve(outputDirectory, 'config.json');
const temporary = resolve(outputDirectory, `.config.${randomUUID()}.tmp`);
await mkdir(outputDirectory, {recursive: true, mode: 0o700});
await chmod(outputDirectory, 0o700);
let handle;
try {
  handle = await open(temporary, 'wx', 0o600);
  await handle.writeFile(`${JSON.stringify(configuration, null, 2)}\n`);
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
process.stdout.write(`Rendered private local MCP configuration to ${target}.\n`);
