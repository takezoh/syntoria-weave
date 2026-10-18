import {runStdio} from './local/server.mjs';

const args = process.argv.slice(2);
let configPath, pluginRoot;
for (let index = 0; index < args.length; index++) {
  const option = args[index];
  if (!['--config', '--plugin-root'].includes(option) || (option === '--config' ? configPath : pluginRoot) !== undefined || typeof args[index + 1] !== 'string') {
    process.stderr.write('Invalid local action-tools server arguments.\n');
    process.exitCode = 2;
    break;
  }
  if (option === '--config') configPath = args[++index];
  else pluginRoot = args[++index];
}
if (process.exitCode !== 2) {
  const dataDirectory = process.env.PLUGIN_DATA;
  await runStdio({configPath, pluginRoot, env: typeof dataDirectory === 'string' ? {PLUGIN_DATA: dataDirectory} : {}});
}
