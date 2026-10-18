import {spawnSync} from 'node:child_process';
for(const args of [['scripts/generate-widget-client.mjs'],['scripts/build-node.mjs'],['node_modules/vite/bin/vite.js','build','--config','build/local-mcp-vite.config.mjs'],['scripts/build-plugin.mjs']]){
 const result=spawnSync(process.execPath,args,{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0){process.exitCode=result.status??1;break;}
}
