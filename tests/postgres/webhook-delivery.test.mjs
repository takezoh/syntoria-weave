import {test} from 'node:test';
import assert from 'node:assert/strict';
import {postgresFixture} from '../helpers/postgres.mjs';
import {gateFixture} from '../helpers/gate.mjs';
import {createServer} from '../../lib/server/node/server.ts';
import {createWebhookSubscriptions} from '../../lib/adapters/postgres/webhook-store.ts';
import {createWebhookDeliveries} from '../../lib/adapters/postgres/webhook-delivery-store.ts';
import {createAuthentication,createGateVerification,sessionCookie} from '../../lib/server/node/authentication.ts';
import {createIdentityStore} from '../../lib/adapters/postgres/identity-store.ts';
import {createPostgresActionStore,cursorScope} from '../../lib/adapters/postgres/action-store.ts';
import {createWebhookCrypto} from '../../lib/server/node/webhook-crypto.ts';
import {webhookEvents} from '../../lib/server/node/webhook-events.ts';
import {createWebhookWorker} from '../../lib/server/node/webhook-delivery.ts';
import {parseSigningSecret,signature} from '../../lib/webhook/signing.ts';
import {actionCall} from '../../lib/application/action-service.ts';
import {fail} from '../../lib/domain/core.ts';

const V='2026-07-28',meta={'io.modelcontextprotocol/protocolVersion':V,'io.modelcontextprotocol/clientCapabilities':{}};
const secret='whsec_'+Buffer.alloc(32,8).toString('base64'),hook='https://receiver.example.com/hooks';
const proposal={title:'Option',instructions:'Draft only',scope:'Prepare a draft',outcome:'A draft',exclusions:'No sending',source:'Test'};

async function setup(t){
 const f=await postgresFixture();t.after(()=>f.close());const gate=await gateFixture();t.after(()=>gate.close());
 const config={origin:'https://api.example.com',issuer:gate.issuer,resource:'https://api.example.com/mcp',browserClientId:'web',spaOrigins:['https://app.example.com'],sharedCookieDomain:'example.com',gateClientId:'resource',gateClientSecret:'synthetic-secret',databaseUrl:f.url,cursorEpoch:crypto.randomUUID(),writeMode:'enabled',clientWriteApproval:'auto',port:8080,localDatabase:true};
 await f.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3)',[gate.issuer,'person','A']);
 const auth=createAuthentication(config,createIdentityStore(f.pool),createGateVerification(config,{fetch:gate.fetch}));
 // Effects outside this process are simulated at their ports: the queue, Gate's connection check and the callback.
 const env={queue:[],queueDown:false,gate:'valid',callbacks:[],respond:()=>({status:200,body:'',truncated:false})};
 const tasks=async(name,path,body)=>{if(env.queueDown)throw new Error('queue unavailable');env.queue.push({name,path,body});};
 const transport=async(url,headers,body)=>{const text=new TextDecoder().decode(body),value=JSON.parse(text);if(value.type==='verification')return {status:200,body:JSON.stringify({challenge:value.challenge}),truncated:false};env.callbacks.push({url,headers,text,body});return env.respond();};
 const keys=createWebhookCrypto({current:'k1',keys:{k1:new Uint8Array(32).fill(4)}});
 const worker=createWebhookWorker({deliveries:createWebhookDeliveries(f.pool),tasks,crypto:keys,transport,gate:async()=>{if(env.gate==='unknown')throw new Error('Gate down');return env.gate;}});
 const server=createServer({config,authentication:auth,log:value=>{if(process.env.DEBUG_WEBHOOK&&(value.status>=500||value.cause||value.event))console.error(JSON.stringify(value));},events:webhookEvents({stores:createWebhookSubscriptions(f.pool),crypto:keys,transport}),
  webhooks:{worker,authenticateTask:async authorization=>{if(authorization!=='Bearer task-token')fail('unauthenticated','Task authentication is required.',401);}},
  invoke:(principal,name,args,signal)=>actionCall({store:createPostgresActionStore(f.pool,principal,{signal,revalidate:c=>auth.revalidate(principal,c),wakeup:worker.wakeup}),clock:()=>new Date().toISOString(),newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope(principal.user,config.cursorEpoch)},name,args)});
 t.after(()=>server.close());
 const token=gate.token(),session=gate.session();
 const mcp=(method,params,name)=>server.inject({method:'POST',url:'/mcp',headers:{host:'api.example.com','content-type':'application/json',authorization:'Bearer '+token,'mcp-protocol-version':V,'mcp-method':method,...(name?{'mcp-name':name}:{})},payload:{jsonrpc:'2.0',id:1,method,params:{_meta:meta,...params}}});
 const api=(name,args)=>server.inject({method:'POST',url:'/api/actions',headers:{host:'api.example.com','content-type':'application/json',cookie:sessionCookie+'='+session,origin:'https://app.example.com','x-csrf-token':'synthetic-csrf'},payload:{name,arguments:args}});
 const write=async(name,args,operationId=crypto.randomUUID())=>{const s=(await api('list_actions',{})).json();const r=await api(name,{schemaVersion:2,operationId,expectedRevision:s.revision,...args});assert.equal(r.statusCode,200,r.body);return r.json();};
 const task=(path,body,authorization='Bearer task-token')=>server.inject({method:'POST',url:path,headers:{host:'api.example.com','content-type':'application/json',...(authorization?{authorization}:{})},payload:body});
 const run=async()=>{const statuses=[];while(env.queue.length){const next=env.queue.shift();statuses.push((await task(next.path,next.body)).statusCode);}return statuses;};
 const subscribe=async()=>{const r=await mcp('events/subscribe',{name:'collaboration_changed',delivery:{mode:'webhook',url:hook,secret}},'collaboration_changed');assert.equal(r.statusCode,200,r.body);return r.json().result.id;};
 const deliveries=async()=>(await f.admin.query('SELECT id,state,attempts,last_error,subscription_id FROM state.webhook_deliveries ORDER BY created_at,position')).rows;
 return {f,env,mcp,api,write,task,run,subscribe,deliveries};
}

test('an approved request reaches the subscribed connection through one precommit wakeup, fan-out and a signed delivery',async t=>{
 const {f,env,api,write,task,run,subscribe,deliveries}=await setup(t);
 const subscriptionId=await subscribe();
 const action=(await write('apply_change',{kind:'add',payload:{title:'Event test'}})).actions[0];
 const created=await write('propose_collaboration',{action_id:action.id,proposal});const key=created.result.collaboration_id;
 assert.equal(env.queue.length,0,'a pending proposal concerns no AI yet');
 const acceptArgs={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:created.revision,id:key,command:'accept',payload:{version:1}};
 const approvedReply=await api('update_collaboration',acceptArgs);assert.equal(approvedReply.statusCode,200,approvedReply.body);const approved=approvedReply.json();
 assert.equal(env.queue.length,1,'exactly one wakeup per write, created before COMMIT');
 const [root]=env.queue;assert.equal(root.path,'/internal/webhook-fanout');assert.deepEqual(Object.keys(root.body).sort(),['batchId','position','user']);
 assert.equal((await f.admin.query('SELECT enqueue_state FROM state.webhook_batches')).rows[0].enqueue_state,'enqueued');
 assert.equal((await task('/internal/webhook-fanout',root.body,null)).statusCode,401,'internal routes require the task identity');
 assert.deepEqual(await run(),[204,204]);
 assert.equal(env.callbacks.length,1);const [sent]=env.callbacks;
 assert.equal(sent.url,hook);
 const event=JSON.parse(sent.text);
 assert.deepEqual(event,{eventId:event.eventId,name:'collaboration_changed',timestamp:event.timestamp,data:{collaboration_id:key,action_id:action.id,revision:approved.revision},cursor:null});
 assert(!sent.text.includes('Draft only')&&!sent.text.includes('Event test'),'events carry identifiers only');
 assert.equal(sent.headers['webhook-id'],event.eventId);assert.equal(sent.headers['x-mcp-subscription-id'],subscriptionId);
 assert.equal(sent.headers['webhook-signature'],signature(createWebhookCrypto({current:'k1',keys:{k1:new Uint8Array(32).fill(4)}}),[parseSigningSecret(secret)],event.eventId,Number(sent.headers['webhook-timestamp']),sent.body));
 assert.deepEqual((await deliveries()).map(row=>row.state),['delivered']);
 assert.equal((await task('/internal/webhook-delivery',{user:'A',deliveryId:event.eventId})).statusCode,204);assert.equal(env.callbacks.length,1,'a duplicate task sends nothing');
 assert.equal((await api('update_collaboration',acceptArgs)).statusCode,200,'the identical request replays its receipt');
 assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM state.webhook_batches')).rows[0].n,1,'identical replay records no second event');
 assert.equal((await task('/internal/webhook-fanout',{user:'A',batchId:'wb_missing',position:0})).statusCode,204,'a rolled-back batch is acknowledged');
});

test('retries keep the event identity, Gate and the callback can stop delivery, and unsubscribe stops pending work',async t=>{
 const {f,env,write,run,subscribe,deliveries,mcp}=await setup(t);
 await subscribe();
 const action=(await write('apply_change',{kind:'add',payload:{title:'Retry test'}})).actions[0];
 const key=(await write('propose_collaboration',{action_id:action.id,proposal})).result.collaboration_id;
 env.respond=()=>({status:503,body:'',truncated:false});
 await write('update_collaboration',{id:key,command:'accept',payload:{version:1}});
 assert.deepEqual(await run(),[204,503]);
 let [row]=await deliveries();assert.equal(row.state,'pending');assert.equal(row.attempts,1);assert.equal(row.last_error,'status_503');
 env.respond=()=>({status:200,body:'',truncated:false});
 env.queue.push({path:'/internal/webhook-delivery',body:{user:'A',deliveryId:row.id}});
 env.gate='unknown';assert.deepEqual(await run(),[503]);assert.equal(env.callbacks.length,1,'no POST while Gate is unknown');
 env.gate='valid';env.queue.push({path:'/internal/webhook-delivery',body:{user:'A',deliveryId:row.id}});
 assert.deepEqual(await run(),[204]);
 assert.equal(env.callbacks.length,2);assert.equal(JSON.parse(env.callbacks[0].text).eventId,JSON.parse(env.callbacks[1].text).eventId);
 [row]=await deliveries();assert.equal(row.state,'delivered');assert.equal(row.attempts,3);

 await write('update_collaboration',{id:key,command:'withdraw',payload:{version:1}});
 env.gate='invalid';assert.deepEqual(await run(),[204,204]);
 assert.equal(env.callbacks.length,2,'a revoked connection receives nothing');
 assert.equal((await f.admin.query('SELECT state FROM state.webhook_subscriptions')).rows[0].state,'stopped');

 env.gate='valid';await mcp('events/subscribe',{name:'collaboration_changed',delivery:{mode:'webhook',url:hook,secret}},'collaboration_changed');
 const second=(await write('apply_change',{kind:'add',payload:{title:'Second'}})).actions[0];
 const other=(await write('propose_collaboration',{action_id:second.id,proposal})).result.collaboration_id;
 await write('update_collaboration',{id:other,command:'accept',payload:{version:1}});
 const fanout=env.queue.shift();assert(fanout);
 const unsubscribed=await mcp('events/unsubscribe',{name:'collaboration_changed',delivery:{url:hook}},'collaboration_changed');assert.equal(unsubscribed.statusCode,200);
 env.queue.unshift(fanout);assert.deepEqual(await run(),[204,204]);
 assert.equal(env.callbacks.length,2,'unsubscribe stops the pending delivery before any POST');
 assert.equal((await deliveries()).at(-1).state,'stopped');
});

test('a failed precommit wakeup keeps the write and is recovered on the next authenticated request',async t=>{
 const {f,env,write,mcp,run,subscribe}=await setup(t);
 await subscribe();
 const action=(await write('apply_change',{kind:'add',payload:{title:'Outage'}})).actions[0];
 const key=(await write('propose_collaboration',{action_id:action.id,proposal})).result.collaboration_id;
 env.queueDown=true;
 await write('update_collaboration',{id:key,command:'accept',payload:{version:1}});
 assert.equal((await f.admin.query('SELECT enqueue_state FROM state.webhook_batches')).rows[0].enqueue_state,'not_enqueued');
 env.queueDown=false;
 assert.equal((await mcp('events/list',{})).statusCode,200);
 assert.equal((await f.admin.query('SELECT enqueue_state FROM state.webhook_batches')).rows[0].enqueue_state,'enqueued');
 assert.deepEqual(await run(),[204,204]);assert.equal(env.callbacks.length,1);
});
