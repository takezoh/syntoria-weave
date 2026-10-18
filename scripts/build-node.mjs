import {build} from 'vite';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
await build({configFile:false,root:resolve('web'),build:{outDir:resolve('dist/spa'),emptyOutDir:true,target:'es2022',rollupOptions:{input:{index:resolve('web/index.html'),authReturn:resolve('web/auth-return.html')}}}});
const widget=spawnSync(process.execPath,['--import','./scripts/testing/register-loader.mjs','scripts/build-spa-widget.mjs'],{stdio:'inherit'});
if(widget.error)throw widget.error;if(widget.status!==0)throw new Error('Static SPA widget build failed.');
await build({configFile:false,resolve:{alias:{'@':resolve('.')}},build:{outDir:'dist/server',emptyOutDir:true,ssr:true,target:'node24',minify:false,rollupOptions:{input:{index:resolve('lib/server/node/main.ts'),admin:resolve('scripts/admin.ts'),backup:resolve('scripts/backup.ts')},output:{entryFileNames:'[name].mjs',chunkFileNames:'chunks/[name]-[hash].mjs'}}}});
