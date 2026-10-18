import {spawn} from 'node:child_process';
import {isAbsolute, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const major = Number(process.versions.node.split('.')[0]);
if (!Number.isInteger(major) || major < 24) {
  process.stderr.write('action-tools requires Node.js 24 or later.\n');
  process.exit(2);
}

const pluginRoot = fileURLToPath(new URL('.', import.meta.url));
const serverPath = join(pluginRoot, 'server.mjs');
const configPath = join(pluginRoot, 'config.json');
const dataPath = process.env.PLUGIN_DATA;
const childEnv = {};
if (typeof dataPath === 'string' && isAbsolute(dataPath) && !dataPath.includes('${')) childEnv.PLUGIN_DATA = dataPath;

const child = spawn(process.execPath, [serverPath, '--config', configPath, '--plugin-root', pluginRoot], {
  cwd: pluginRoot,
  env: childEnv,
  stdio: 'inherit',
  windowsHide: true,
});
const forward = signal => { if (!child.killed) child.kill(signal); };
process.once('SIGINT', forward);
process.once('SIGTERM', forward);
child.on('error', () => {
  process.stderr.write('action-tools could not start its local MCP server.\n');
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.removeListener('SIGINT', forward);
  process.removeListener('SIGTERM', forward);
  process.exitCode = signal ? 1 : code ?? 1;
});
