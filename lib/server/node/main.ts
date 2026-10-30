import {createMcpSubscriptions} from '../../adapters/postgres/mcp-subscriptions';
import {randomUUID} from 'node:crypto';
import {readConfig} from './config';
import {createPool} from '../../adapters/postgres/pool';
import {checkRuntime} from '../../adapters/postgres/migrations';
import {createIdentityStore} from '../../adapters/postgres/identity-store';
import {createPostgresActionStore,cursorScope} from '../../adapters/postgres/action-store';
import {createWebhookSubscriptions} from '../../adapters/postgres/webhook-store';
import {createWebhookDeliveries} from '../../adapters/postgres/webhook-delivery-store';
import {createAuthentication} from './authentication';
import {createServer} from './server';
import {createWebhookCrypto,parseKeyRing} from './webhook-crypto';
import {createCallbackTransport} from './webhook-https';
import {webhookEvents} from './webhook-events';
import {createWebhookWorker} from './webhook-delivery';
import {createCloudTasks,metadataAccessToken} from './cloud-tasks';
import {createGateConnectionCheck} from './gate-connection';
import {createTaskAuthentication} from './task-authentication';
import {actionCall} from '../../application/action-service';
const config=readConfig(process.env),pool=createPool(config.databaseUrl,{local:config.localDatabase});
await checkRuntime(pool);
const auth=createAuthentication(config,createIdentityStore(pool));
const crypto=createWebhookCrypto(parseKeyRing(config.webhookKeyRing)),transport=createCallbackTransport(),taskAudience=config.origin+'/internal/webhook';
const worker=createWebhookWorker({deliveries:createWebhookDeliveries(pool),crypto,transport,
 tasks:createCloudTasks({queue:config.webhookTaskQueue,origin:config.origin,serviceAccount:config.webhookTaskServiceAccount,audience:taskAudience,token:metadataAccessToken()}),
 gate:createGateConnectionCheck({issuer:config.issuer,clientId:config.gateClientId,clientSecret:config.gateClientSecret})});
const server=createServer({config,authentication:auth,subscriptions:createMcpSubscriptions(pool),
 events:webhookEvents({stores:createWebhookSubscriptions(pool),crypto,transport}),
 webhooks:{worker,authenticateTask:createTaskAuthentication({audience:taskAudience,serviceAccount:config.webhookTaskServiceAccount})},
 log:value=>console.log(JSON.stringify(value)),
 invoke:(identity,name,args,signal,observe)=>actionCall({store:createPostgresActionStore(pool,identity,{revalidate:client=>auth.revalidate(identity,client),signal,observe,wakeup:worker.wakeup}),clock:()=>new Date().toISOString(),newId:randomUUID,changeCursorScope:async()=>cursorScope(identity.user,config.cursorEpoch)},name,args)});
let stopping=false;
async function shutdown(){if(stopping)return;stopping=true;const timer=setTimeout(()=>process.exit(1),8000);timer.unref();try{await server.close();await pool.end();}finally{clearTimeout(timer);}}
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
await server.listen({host:'0.0.0.0',port:config.port});
