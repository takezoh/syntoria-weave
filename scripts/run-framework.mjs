import {spawn} from 'node:child_process';
import {readExecutionProfile} from './execution-profile.mjs';
// Validate checkout-local profile syntax; every profile now builds the same Node service.
readExecutionProfile();
const [command,...args]=process.argv.slice(2);
if(!['dev','build'].includes(command)||args.length)throw new Error('Expected dev or build without extra arguments.');
await import('./build-node.mjs');
if(command==='dev'){
 const child=spawn(process.execPath,['scripts/serve-spa.mjs'],{stdio:'inherit',env:{...process.env,PORT:process.env.PORT??'5173'}});
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
 child.once('exit',code=>{process.exitCode=code??1;});
}
