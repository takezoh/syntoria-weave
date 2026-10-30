import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import boundaries from './scripts/lint/boundaries.mjs';

export default defineConfig([
  ...tseslint.configs.recommended,
  globalIgnores([
    'dist/**', '.local/**', 'infra/.local/**', 'coverage/**',
    '.sites-runtime/**', '.wrangler/**', '.next/**', '.vinext/**',
    '!build/', '!build/**',
    // Negative fixtures intentionally violate architecture rules and are linted by the harness.
    'tests/fixtures/**',
  ]),
  {
    files: ['lib/**/*.{ts,tsx,mts,js,jsx,mjs}', 'build/**/*.{ts,mjs}'],
    plugins: { architecture: boundaries },
    rules: { 'architecture/dependency-direction': 'error', 'architecture/data-type-only': 'error', 'architecture/raw-sql-location': 'error', 'architecture/capability-direction':'error', 'architecture/user-sql':'error' },
  },
  {
    files: ['lib/ui/effects/dom.js'],
    plugins: { architecture: boundaries },
    rules: { 'architecture/readonly-ui-state': 'error' },
  },
  {
    // Public/local MCP surfaces must not reach the private composition or storage adapters.
    files: ['lib/mcp/**/*.{ts,mts,js,mjs}', 'build/local-mcp-vite.config.mjs'],
    plugins: { architecture: boundaries },
    rules: { 'architecture/private-composition': 'error' },
  },
  {
    files: ['lib/data/**/*.{ts,tsx,mts,js,jsx,mjs}', 'lib/domain/**/*.{ts,tsx,mts,js,jsx,mjs}', 'lib/ui/model/**/*.{ts,tsx,mts,js,jsx,mjs}', 'lib/application/**/*.{ts,tsx,mts,js,jsx,mjs}', 'lib/webhook/**/*.{ts,tsx,mts,js,jsx,mjs}', 'lib/ui/effects/tool-client.{ts,tsx,mts,js,jsx,mjs}', 'lib/ui/application/**/*.{ts,tsx,mts,js,jsx,mjs}', 'lib/ui/components/**/*.{ts,tsx,mts,js,jsx,mjs}', 'lib/ui/ports.{ts,tsx,mts,js,jsx,mjs}'],
    rules: { 'architecture/pure-effects': 'error' },
  },
  {
    files: ['lib/ui/model/**/*.{ts,tsx,mts,js,jsx,mjs}'],
    rules: { 'architecture/ui-model-capability': 'error' },
  },
  {
    files: ['lib/data/**/*.{ts,tsx,mts,js,jsx,mjs}', 'lib/domain/**/*.{ts,tsx,mts,js,jsx,mjs}', 'lib/ui/model/**/*.{ts,tsx,mts,js,jsx,mjs}'],
    rules: { 'no-param-reassign': ['error', { props: true }] },
  },
]);
