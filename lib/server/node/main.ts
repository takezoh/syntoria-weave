import {randomUUID} from 'node:crypto';
import {readConfig} from './config';
import {createPool} from '../../adapters/postgres/pool';
import {checkRuntime} from '../../adapters/postgres/migrations';
import {createIdentityStore} from '../../adapters/postgres/identity-store';
import {createPostgresActionStore,cursorScope} from '../../adapters/postgres/action-store';
import {createAuthentication} from './authentication';
import {createServer} from './server';
import {actionCall} from '../../application/action-service';
const config=readConfig(process.env),pool=createPool(config.databaseUrl,{local:config.localDatabase});
await checkRuntime(pool);
const auth=createAuthentication(config,createIdentityStore(pool));
const server=createServer({config,authentication:auth,
 log:value=>console.log(JSON.stringify(value)),
 invoke:(identity,name,args,signal,observe)=>actionCall({store:createPostgresActionStore(pool,identity,{revalidate:client=>auth.revalidate(identity,client),signal,observe}),clock:()=>new Date().toISOString(),newId:randomUUID,changeCursorScope:async()=>cursorScope(identity.user,config.cursorEpoch)},name,args)});
let stopping=false;
async function shutdown(){if(stopping)return;stopping=true;const timer=setTimeout(()=>process.exit(1),8000);timer.unref();try{await server.close();await pool.end();}finally{clearTimeout(timer);}}
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
await server.listen({host:'0.0.0.0',port:config.port});
