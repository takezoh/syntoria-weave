import {spawn} from 'node:child_process';
import {isAbsolute, resolve} from 'node:path';

const args = process.argv.slice(2);
const childEnv = {};
if (typeof process.env.PLUGIN_DATA === 'string' && isAbsolute(process.env.PLUGIN_DATA) && !process.env.PLUGIN_DATA.includes('${')) childEnv.PLUGIN_DATA = process.env.PLUGIN_DATA;
const child = spawn(process.execPath, [resolve('dist/local/server.mjs'), ...args], {env: childEnv, stdio: 'inherit'});
child.on('error', error => {
  process.stderr.write(`Could not start the local action-tools server: ${error.message}\n`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; });
