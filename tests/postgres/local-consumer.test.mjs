import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import test from 'node:test';

test('local MCP connects and forwards through real HTTP/MCP and PostgreSQL', {timeout: 120_000}, () => {
  const root = resolve(new URL('../..', import.meta.url).pathname);
  const result = spawnSync(process.execPath, [
    '--import', './scripts/testing/register-loader.mjs',
    'scripts/testing/verify-local-consumer.mjs',
  ], {cwd: root, env: process.env, encoding: 'utf8', timeout: 110_000});
  assert.equal(result.error, undefined, result.stderr);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /passed: real Node HTTP\/MCP and PostgreSQL forwarding/);
});
