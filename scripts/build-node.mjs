import {build} from 'vite';
import {resolve} from 'node:path';
await build({configFile:false,root:resolve('web'),build:{outDir:resolve('dist/web'),emptyOutDir:true,target:'es2022'}});
await build({configFile:false,resolve:{alias:{'@':resolve('.')}},build:{outDir:'dist/server',emptyOutDir:true,ssr:true,target:'node24',minify:false,rollupOptions:{input:{index:resolve('lib/server/node/main.ts'),admin:resolve('scripts/admin.ts'),backup:resolve('scripts/backup.ts')},output:{entryFileNames:'[name].mjs',chunkFileNames:'chunks/[name]-[hash].mjs'}}}});
