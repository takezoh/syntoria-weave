import {test} from 'node:test';
import assert from 'node:assert/strict';
import {postgresFixture} from '../helpers/postgres.mjs';
import {gateFixture} from '../helpers/gate.mjs';
import {createServer} from '../../lib/server/node/server.ts';
import {createMcpSubscriptions} from '../../lib/adapters/postgres/mcp-subscriptions.ts';
import {createWebhookSubscriptions} from '../../lib/adapters/postgres/webhook-store.ts';
import {createAuthentication,createGateVerification} from '../../lib/server/node/authentication.ts';
import {createIdentityStore} from '../../lib/adapters/postgres/identity-store.ts';
import {createPostgresActionStore,cursorScope} from '../../lib/adapters/postgres/action-store.ts';
import {createWebhookCrypto} from '../../lib/server/node/webhook-crypto.ts';
import {webhookEvents} from '../../lib/server/node/webhook-events.ts';
import {actionCall} from '../../lib/application/action-service.ts';

const V='2026-07-28',meta={'io.modelcontextprotocol/protocolVersion':V,'io.modelcontextprotocol/clientCapabilities':{}};
const secret='whsec_'+Buffer.alloc(32,5).toString('base64'),rotated='whsec_'+Buffer.alloc(32,6).toString('base64');
const delivery=(url='https://receiver.example.com/hooks',value=secret)=>({mode:'webhook',url,secret:value});

async function setup(t){
 const f=await postgresFixture();t.after(()=>f.close());const gate=await gateFixture();t.after(()=>gate.close());
 const config={origin:'https://api.example.com',issuer:gate.issuer,resource:'https://api.example.com/mcp',browserClientId:'web',spaOrigins:['https://app.example.com'],sharedCookieDomain:'example.com',gateClientId:'resource',gateClientSecret:'synthetic-secret',databaseUrl:f.url,cursorEpoch:crypto.randomUUID(),writeMode:'enabled',clientWriteApproval:'auto',port:8080,localDatabase:true};
 await f.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3),($1,$4,$5)',[gate.issuer,'person','A','other','B']);
 const auth=createAuthentication(config,createIdentityStore(f.pool),createGateVerification(config,{fetch:gate.fetch}));
 // The callback is simulated at the transport port; the real HTTPS adapter has its own suite.
 const callback={requests:[],echo:true,status:200};
 const transport=async(url,headers,body)=>{const text=new TextDecoder().decode(body);callback.requests.push({url,headers,body:text});return {status:callback.status,body:JSON.stringify({challenge:callback.echo===true?JSON.parse(text).challenge:callback.echo}),truncated:false};};
 const keys={current:'k1',keys:{k1:new Uint8Array(32).fill(1)}};
 const server=createServer({config,authentication:auth,subscriptions:createMcpSubscriptions(f.pool),
  events:webhookEvents({stores:createWebhookSubscriptions(f.pool),crypto:createWebhookCrypto(keys),transport}),
  invoke:(principal,name,args,signal)=>actionCall({store:createPostgresActionStore(f.pool,principal,{signal,revalidate:c=>auth.revalidate(principal,c)}),clock:()=>new Date().toISOString(),newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope(principal.user,config.cursorEpoch)},name,args)});
 t.after(()=>server.close());
 const post=(bearer,method,params,{name,headers={}}={})=>server.inject({method:'POST',url:'/mcp',headers:{host:'api.example.com','content-type':'application/json',authorization:'Bearer '+bearer,'mcp-protocol-version':V,'mcp-method':method,...(name?{'mcp-name':name}:{}),...headers},payload:{jsonrpc:'2.0',id:1,method,params:{_meta:meta,...params}}});
 const rows=async()=>(await f.admin.query('SELECT user_id,id,connection_id,state,generation,expires_at,secret_ciphertext,secret_key_id,url FROM state.webhook_subscriptions ORDER BY user_id,id')).rows;
 return {f,gate,server,post,rows,callback};
}

test('2026-07-28 clients discover, list, subscribe idempotently and unsubscribe without touching business state',async t=>{
 const {gate,server,post,rows,callback,f}=await setup(t);const token=gate.token();
 const discover=await post(token,'server/discover',{});assert.equal(discover.statusCode,200);
 assert.deepEqual(discover.json().result.capabilities.events,{});assert.equal(discover.json().result.capabilities.resources.subscribe,true);
 const legacy=await server.inject({method:'POST',url:'/mcp',headers:{host:'api.example.com','content-type':'application/json',authorization:'Bearer '+token},payload:{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}}});
 assert.equal(legacy.json().result.capabilities.events,undefined,'2025 revisions advertise no events');
 const legacyList=await server.inject({method:'POST',url:'/mcp',headers:{host:'api.example.com','content-type':'application/json',authorization:'Bearer '+token},payload:{jsonrpc:'2.0',id:2,method:'events/list',params:{}}});
 assert.equal(legacyList.json().error.code,-32601);
 const list=(await post(token,'events/list',{})).json().result;
 assert.equal(list.resultType,'complete');assert.equal(list.nextCursor,undefined);assert.equal(list.events.length,1);
 const [event]=list.events;assert.equal(event.name,'collaboration_changed');assert.deepEqual(event.delivery,['webhook']);
 assert.deepEqual(event.inputSchema,{type:'object',properties:{},additionalProperties:false});assert.deepEqual(event.payloadSchema.required,['collaboration_id','action_id','revision']);
 assert.equal((await post(token,'events/list',{cursor:'x'})).json().error.code,-32602);

 const before=(await f.admin.query('SELECT count(*)::int AS n FROM state.operations')).rows[0].n;
 const missingName=await post(token,'events/subscribe',{name:'collaboration_changed',arguments:{},delivery:delivery()});
 assert.equal(missingName.statusCode,400,'Mcp-Name must name the event');
 const first=await post(token,'events/subscribe',{name:'collaboration_changed',arguments:{},delivery:delivery(),ttlMs:null},{name:'collaboration_changed'});
 assert.equal(first.statusCode,200,first.body);const subscribed=first.json().result;
 assert.match(subscribed.id,/^sub_[0-9a-f]{64}$/);assert.equal(subscribed.cursor,null);assert.equal(subscribed.truncated,false);
 assert(Date.parse(subscribed.refreshBefore)>Date.now()+23*3_600_000,'a null lifetime receives the finite default');
 assert.equal(callback.requests.length,1);const challenge=JSON.parse(callback.requests[0].body);assert.equal(challenge.type,'verification');
 let stored=await rows();assert.equal(stored.length,1);assert.equal(stored[0].state,'active');assert.equal(stored[0].user_id,'A');
 assert(!stored[0].secret_ciphertext.includes(secret.slice(6)));assert.equal(stored[0].secret_key_id,'k1');
 const again=(await post(token,'events/subscribe',{name:'collaboration_changed',delivery:delivery('https://RECEIVER.example.com:443/hooks'),ttlMs:3_600_000},{name:'collaboration_changed'})).json().result;
 assert.equal(again.id,subscribed.id);assert.equal(callback.requests.length,1,'refresh needs no new challenge');
 stored=await rows();assert.equal(stored.length,1);assert.equal(Number(stored[0].generation),1);

 const rotation=(await post(token,'events/subscribe',{name:'collaboration_changed',delivery:delivery(undefined,rotated)},{name:'collaboration_changed'})).json().result;
 assert.equal(rotation.id,subscribed.id);assert.equal(callback.requests.length,2,'a new secret is verified');assert.equal(Number((await rows())[0].generation),2);

 for(let i=0;i<2;i++){const gone=await post(token,'events/unsubscribe',{name:'collaboration_changed',arguments:{},delivery:{mode:'webhook',url:'https://receiver.example.com/hooks'}},{name:'collaboration_changed'});assert.equal(gone.statusCode,200,gone.body);assert.equal(gone.json().result.resultType,'complete');}
 stored=await rows();assert.equal(stored[0].state,'stopped');assert.equal(stored[0].secret_ciphertext,null);assert.equal(Number(stored[0].generation),4);
 assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM state.operations')).rows[0].n,before,'subscriptions write no receipts');
});

test('callback failures report -32015 with a reason and leave no active subscription; connections and users stay isolated',async t=>{
 const {gate,post,rows,callback}=await setup(t);
 const token=gate.token(),sameUserOtherConnection=gate.token(),otherUser=gate.token({subject:'other'});
 callback.echo='wrong';
 const failed=(await post(token,'events/subscribe',{name:'collaboration_changed',delivery:delivery()},{name:'collaboration_changed'})).json();
 assert.equal(failed.error.code,-32015);assert.deepEqual(failed.error.data,{reason:'challenge_failed'});
 callback.echo=true;callback.status=500;
 assert.deepEqual((await post(token,'events/subscribe',{name:'collaboration_changed',delivery:delivery()},{name:'collaboration_changed'})).json().error.data,{reason:'endpoint_rejected'});
 assert.equal((await rows()).length,0);
 callback.status=200;
 for(const [params,label] of [[{name:'collaboration_changed',delivery:delivery('https://10.0.0.8/h')},'private callback'],[{name:'collaboration_changed',delivery:delivery(undefined,'whsec_short')},'secret'],[{name:'collaboration_changed',arguments:{collaboration_id:'x'},delivery:delivery()},'arguments'],[{name:'collaboration_changed',delivery:delivery(),cursor:'evt_1'},'replay cursor']]){
  const reply=(await post(token,'events/subscribe',params,{name:'collaboration_changed'})).json();assert.equal(reply.error.code,-32602,label);
 }
 const mine=(await post(token,'events/subscribe',{name:'collaboration_changed',delivery:delivery()},{name:'collaboration_changed'})).json().result;
 const sibling=(await post(sameUserOtherConnection,'events/subscribe',{name:'collaboration_changed',delivery:delivery()},{name:'collaboration_changed'})).json().result;
 const theirs=(await post(otherUser,'events/subscribe',{name:'collaboration_changed',delivery:delivery()},{name:'collaboration_changed'})).json().result;
 assert.equal(new Set([mine.id,sibling.id,theirs.id]).size,3,'identities are per connection');
 await post(otherUser,'events/unsubscribe',{name:'collaboration_changed',delivery:{url:'https://receiver.example.com/hooks'}},{name:'collaboration_changed'});
 await post(sameUserOtherConnection,'events/unsubscribe',{name:'collaboration_changed',delivery:{url:'https://receiver.example.com/hooks'}},{name:'collaboration_changed'});
 const states=Object.fromEntries((await rows()).map(row=>[row.id,row.state]));
 assert.equal(states[mine.id],'active');assert.equal(states[sibling.id],'stopped');assert.equal(states[theirs.id],'stopped');
 const forged=await post(token,'events/unsubscribe',{name:'collaboration_changed',delivery:{url:'https://receiver.example.com/hooks'}},{name:'collaboration_changed',headers:{'x-user-id':'B','oai-authenticated-user':'B'}});
 assert.equal(forged.statusCode,200);assert.equal(Object.fromEntries((await rows()).map(row=>[row.id,row.state]))[theirs.id],'stopped');
 gate.revoke(token);
 assert.equal((await post(token,'events/subscribe',{name:'collaboration_changed',delivery:delivery()},{name:'collaboration_changed'})).statusCode,401,'a revoked connection cannot refresh');
});

test('the PostgreSQL store activates one concurrent first subscription and rejects stale generations',async t=>{
 const {f}=await setup(t);
 const {issuePrincipal}=await import('../../lib/server/node/principal.ts');
 const principal=issuePrincipal({user:'A',issuer:'https://gate.example.test',subject:'person',connectionId:'c-1',clientId:'client-1',actorKind:'client',scopes:['state:read']});
 const store=createWebhookSubscriptions(f.pool)(principal);
 const activation=n=>({id:'sub_race',eventName:'collaboration_changed',arguments:'{}',url:'https://receiver.example.com/h',expiresAt:new Date(Date.now()+3_600_000).toISOString(),secret:{keyId:'k1',ciphertext:'c'+n},secretDigest:'d'+n,proofExpiresAt:new Date(Date.now()+300_000).toISOString(),previousSecret:null,previousUntil:null});
 const results=await Promise.all([1,2,3,4].map(n=>store.activate(activation(n),null)));
 assert.equal(results.filter(Boolean).length,1);
 const current=await store.find('sub_race');assert.equal(current.state,'active');assert.equal(current.generation,1);
 const [a,b]=await Promise.all([store.activate(activation(5),1),store.activate(activation(6),1)]);
 assert.equal(Number(a)+Number(b),1,'one compare-and-swap wins');
 assert.equal(await store.refresh('sub_race',1,new Date().toISOString()),false,'a stale generation cannot refresh');
 await store.stop({id:'sub_race',eventName:'collaboration_changed',arguments:'{}',url:'https://receiver.example.com/h'});
 assert.equal(await store.activate(activation(7),2),false,'a proof read before the stop cannot reactivate it');
 const stopped=await store.find('sub_race');assert.equal(stopped.state,'stopped');assert.equal(stopped.generation,3);assert.equal(stopped.secret,null);
 const other=createWebhookSubscriptions(f.pool)(issuePrincipal({...principal,user:'B',subject:'other',connectionId:'c-2'}));
 assert.equal(await other.find('sub_race'),null,'another user never reads the row');
});
