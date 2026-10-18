import {defineConfig} from 'vite';
import {builtinModules} from 'node:module';
import {resolve} from 'node:path';
export default defineConfig({
  resolve: {alias: {'@': resolve('.') }},
  build: {
    target: 'node24',
    outDir: 'dist/local',
    emptyOutDir: true,
    lib: {entry: resolve('lib/mcp/local-server.mjs'), formats: ['es'], fileName: () => 'server.mjs'},
    rollupOptions: {external: [...builtinModules, ...builtinModules.map(name => `node:${name}`), /^node:/]},
  },
});
