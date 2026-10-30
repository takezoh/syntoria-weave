import http from 'node:http';
import {Readable} from 'node:stream';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {postgresFixture} from '../helpers/postgres.mjs';
import {gateFixture} from '../helpers/gate.mjs';
import {createServer} from '../../lib/server/node/server.ts';
import {createMcpSubscriptions} from '../../lib/adapters/postgres/mcp-subscriptions.ts';
import {createAuthentication,createGateVerification,sessionCookie} from '../../lib/server/node/authentication.ts';
import {createIdentityStore} from '../../lib/adapters/postgres/identity-store.ts';
import {createPostgresActionStore,cursorScope} from '../../lib/adapters/postgres/action-store.ts';
import {actionCall} from '../../lib/application/action-service.ts';
const uri='action-state://current';
const streamRequest=(url,{headers,signal})=>new Promise((resolve,reject)=>{const req=http.get(url,{headers,signal},res=>resolve({status:res.statusCode,headers:new Headers(res.headers),body:Readable.toWeb(res)}));req.on('error',reject);});
const postStream=(url,{headers,body,signal})=>new Promise((resolve,reject)=>{const req=http.request(url,{method:'POST',headers:{...headers,'content-length':Buffer.byteLength(body)},signal},res=>resolve({status:res.statusCode,headers:new Headers(res.headers),body:Readable.toWeb(res)}));req.on('error',reject);req.end(body);});
function sseReader(body){
 const reader=body.getReader(),decoder=new TextDecoder();let buffer='';
 return {async next(){const deadline=Date.now()+8000;while(Date.now()<deadline){let end;while((end=buffer.indexOf('\n\n'))!==-1){const lines=buffer.slice(0,end).split('\n');buffer=buffer.slice(end+2);const data=lines.find(line=>line.startsWith('data: '));if(data)return {event:JSON.parse(data.slice(6)),id:lines.find(line=>line.startsWith('id: '))?.slice(4)};}const part=await reader.read();if(part.done)return null;buffer+=decoder.decode(part.value,{stream:true});}throw new Error('Notification deadline');}};
}

test('MCP SSE carries UI decisions across instances, resumes by user cursor and stops after revocation',async t=>{
 const f=await postgresFixture();t.after(()=>f.close());const gate=await gateFixture();t.after(()=>gate.close());
 const config={origin:'https://api.example.com',issuer:gate.issuer,resource:'https://api.example.com/mcp',browserClientId:'web',spaOrigins:['https://app.example.com'],sharedCookieDomain:'example.com',gateClientId:'resource',gateClientSecret:'synthetic-secret',databaseUrl:f.url,cursorEpoch:crypto.randomUUID(),writeMode:'enabled',clientWriteApproval:'auto',port:8080,localDatabase:true};
 await f.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3),($1,$4,$5)',[gate.issuer,'person','A','other','B']);
 const auth=createAuthentication(config,createIdentityStore(f.pool),createGateVerification(config,{fetch:gate.fetch}));
 const make=()=>createServer({config,authentication:auth,subscriptions:createMcpSubscriptions(f.pool),invoke:(principal,name,args,signal)=>actionCall({store:createPostgresActionStore(f.pool,principal,{signal,revalidate:c=>auth.revalidate(principal,c)}),clock:()=>new Date().toISOString(),newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope(principal.user,config.cursorEpoch)},name,args)});
 const first=make(),second=make();t.after(()=>first.close());t.after(()=>second.close());
 const address=await second.listen({host:'127.0.0.1',port:0});
 const token=gate.token(),otherToken=gate.token({subject:'other'}),sameUserOtherConnection=gate.token(),session=gate.session();
 const rpc=async(server,method,params={},bearer=token)=>{const r=await server.inject({method:'POST',url:'/mcp',headers:{host:'api.example.com','content-type':'application/json',authorization:'Bearer '+bearer},payload:{jsonrpc:'2.0',id:1,method,params}});assert.equal(r.statusCode,200,r.body);return r.json().result;};
 const call=async(name,args={})=>(await rpc(first,'tools/call',{name,arguments:args})).structuredContent;
 const write=async(name,args)=>{const s=await call('list_actions');const r=await first.inject({method:'POST',url:'/api/actions',headers:{host:'api.example.com','content-type':'application/json',cookie:sessionCookie+'='+session,origin:'https://app.example.com','x-csrf-token':'synthetic-csrf'},payload:{name,arguments:{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:s.revision,...args}}});assert.equal(r.statusCode,200,r.body);return r.json();};
 assert.equal((await rpc(first,'initialize')).capabilities.resources.subscribe,true);
 await rpc(first,'resources/subscribe',{uri});
 const streamHeaders={host:'api.example.com',authorization:'Bearer '+token,accept:'text/event-stream'};
 const denied=await second.inject({url:'/mcp',headers:{...streamHeaders,authorization:'Bearer '+sameUserOtherConnection}});assert.equal(denied.statusCode,409);
 assert.equal((await f.pool.query('SELECT * FROM state.mcp_subscriptions')).rowCount,1);
 const otherDenied=await second.inject({url:'/mcp',headers:{...streamHeaders,authorization:'Bearer '+otherToken}});assert.equal(otherDenied.statusCode,409);
 const abort=new AbortController();t.after(()=>abort.abort());
 const response=await streamRequest(address+'/mcp',{headers:streamHeaders,signal:abort.signal});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/event-stream/);
 const reader=response.body.getReader();let buffer='';
 async function nextNotification(){const deadline=Date.now()+8000;while(Date.now()<deadline){let end;while((end=buffer.indexOf('\n\n'))!==-1){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=block.split('\n').find(line=>line.startsWith('data: '));if(data)return {event:JSON.parse(data.slice(6)),cursor:block.split('\n').find(line=>line.startsWith('id: ')).slice(4)};}const part=await reader.read();if(part.done)return null;buffer+=new TextDecoder().decode(part.value);}throw new Error('Notification deadline');}
 const initial=await nextNotification();assert.equal(initial.event.method,'notifications/resources/updated');assert.equal(initial.event.params.uri,uri);
 const action=(await write('apply_change',{kind:'add',payload:{title:'Event test'}})).actions[0];
 const proposal={title:'Option',instructions:'Draft only',scope:'Prepare a draft',outcome:'A draft',exclusions:'No sending',source:'Test'};
 const created=await write('propose_collaboration',{action_id:action.id,proposal});const key=created.result.collaboration_id;
 const approved=await write('update_collaboration',{id:key,command:'accept',payload:{version:1}});
 let event;do{event=await nextNotification();assert(event);}while(event.event.params._meta.revision<approved.revision);
 const current=JSON.parse((await rpc(first,'resources/read',{uri})).contents[0].text);assert.equal(current.collaborations.find(c=>c.id===key).decision,'accepted');
 const edited=await write('update_collaboration',{id:key,command:'revise',payload:{version:1,proposal:{...proposal,scope:'User corrected scope'}}});
 do{event=await nextNotification();assert(event);}while(event.event.params._meta.revision<edited.revision);
 const updated=JSON.parse((await rpc(first,'resources/read',{uri})).contents[0].text).collaborations.find(c=>c.id===key);assert.equal(updated.version,2);assert.equal(updated.proposal.scope,'User corrected scope');assert.equal(updated.decision,'pending');
 await write('update_collaboration',{id:key,command:'accept',payload:{version:2}});
 const last=event.cursor;abort.abort();
 const cancelled=await write('update_collaboration',{id:key,command:'withdraw',payload:{version:2}});
 await rpc(first,'resources/subscribe',{uri},otherToken);
 assert.equal((await second.inject({url:'/mcp',headers:{...streamHeaders,authorization:'Bearer '+otherToken,'last-event-id':last}})).statusCode,400);
 const resumeAbort=new AbortController();t.after(()=>resumeAbort.abort());
 const resumed=await streamRequest(address+'/mcp',{headers:{...streamHeaders,'last-event-id':last},signal:resumeAbort.signal});assert.equal(resumed.status,200);const resumedReader=resumed.body.getReader();let chunks='';while(!chunks.includes('data: ')){chunks+=new TextDecoder().decode((await resumedReader.read()).value);}
 assert(chunks.includes('"revision":'+cancelled.revision));gate.revoke(token);
 let ended=false;for(let n=0;n<5;n++){const part=await resumedReader.read();if(part.done){ended=true;break;}}assert(ended,'revoked stream closes without further notifications');
 const final=JSON.parse((await rpc(first,'resources/read',{uri},sameUserOtherConnection)).contents[0].text);assert.equal(final.collaborations.find(c=>c.id===key).decision,'pending');assert.equal(final.actions[0].status,'active');
 await rpc(first,'resources/unsubscribe',{uri},otherToken);assert.equal((await second.inject({url:'/mcp',headers:{...streamHeaders,authorization:'Bearer '+otherToken}})).statusCode,409);
});

test('MCP subscriptions/listen streams acknowledged hints on the POST response without stored subscriptions',async t=>{
 const f=await postgresFixture();t.after(()=>f.close());const gate=await gateFixture();t.after(()=>gate.close());
 const config={origin:'https://api.example.com',issuer:gate.issuer,resource:'https://api.example.com/mcp',browserClientId:'web',spaOrigins:['https://app.example.com'],sharedCookieDomain:'example.com',gateClientId:'resource',gateClientSecret:'synthetic-secret',databaseUrl:f.url,cursorEpoch:crypto.randomUUID(),writeMode:'enabled',clientWriteApproval:'auto',port:8080,localDatabase:true};
 await f.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3)',[gate.issuer,'person','A']);
 const auth=createAuthentication(config,createIdentityStore(f.pool),createGateVerification(config,{fetch:gate.fetch}));
 const logs=[],server=createServer({config,authentication:auth,subscriptions:createMcpSubscriptions(f.pool),log:value=>logs.push(value),invoke:(principal,name,args,signal)=>actionCall({store:createPostgresActionStore(f.pool,principal,{signal,revalidate:c=>auth.revalidate(principal,c)}),clock:()=>new Date().toISOString(),newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope(principal.user,config.cursorEpoch)},name,args)});
 t.after(()=>server.close());const address=await server.listen({host:'127.0.0.1',port:0});
 const V='2026-07-28',meta={'io.modelcontextprotocol/protocolVersion':V,'io.modelcontextprotocol/clientCapabilities':{}},token=gate.token(),session=gate.session();
 const write=async args=>{const r=await server.inject({method:'POST',url:'/api/actions',headers:{host:'api.example.com','content-type':'application/json',cookie:sessionCookie+'='+session,origin:'https://app.example.com','x-csrf-token':'synthetic-csrf'},payload:{name:'list_actions'}});const revision=r.json().revision;const w=await server.inject({method:'POST',url:'/api/actions',headers:{host:'api.example.com','content-type':'application/json',cookie:sessionCookie+'='+session,origin:'https://app.example.com','x-csrf-token':'synthetic-csrf'},payload:{name:'apply_change',arguments:{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:revision,...args}}});assert.equal(w.statusCode,200,w.body);return w.json();};
 const open=async(id,notifications)=>{const abort=new AbortController();t.after(()=>abort.abort());const response=await postStream(address+'/mcp',{headers:{host:'api.example.com','content-type':'application/json',accept:'application/json, text/event-stream',authorization:'Bearer '+token,'mcp-protocol-version':V,'mcp-method':'subscriptions/listen'},body:JSON.stringify({jsonrpc:'2.0',id,method:'subscriptions/listen',params:{_meta:meta,notifications}}),signal:abort.signal});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/event-stream/);return sseReader(response.body);};
 const idle=await open(7,{promptsListChanged:true,resourceSubscriptions:['action-state://unknown']});
 assert.deepEqual((await idle.next()).event,{jsonrpc:'2.0',method:'notifications/subscriptions/acknowledged',params:{_meta:{'io.modelcontextprotocol/subscriptionId':7},notifications:{}}});
 assert.deepEqual((await idle.next()).event,{jsonrpc:'2.0',id:7,result:{resultType:'complete',_meta:{'io.modelcontextprotocol/subscriptionId':7,'io.modelcontextprotocol/serverInfo':{name:'action-tools',version:'0.3.0'}}}});
 assert.equal(await idle.next(),null,'a subscription with nothing to deliver ends after its completion result');
 const stream=await open('listen-1',{toolsListChanged:true,resourceSubscriptions:[uri,'action-state://unknown']});
 const ack=await stream.next();assert.equal(ack.id,undefined,'listen frames carry no resumable cursor');
 assert.deepEqual(ack.event.params,{_meta:{'io.modelcontextprotocol/subscriptionId':'listen-1'},notifications:{resourceSubscriptions:[uri]}});
 const initial=await stream.next();assert.equal(initial.event.method,'notifications/resources/updated');assert.equal(initial.event.params.uri,uri);assert.equal(initial.event.params._meta['io.modelcontextprotocol/subscriptionId'],'listen-1');
 assert.equal((await f.pool.query('SELECT count(*)::int AS count FROM state.mcp_subscriptions')).rows[0].count,0);
 const added=await write({kind:'add',payload:{title:'Listen test'}});
 let event;do{event=await stream.next();assert(event);}while(event.event.params._meta.revision<added.revision);
 assert.deepEqual([event.id,event.event.params.uri,event.event.params._meta['io.modelcontextprotocol/subscriptionId']],[undefined,uri,'listen-1']);
 assert.equal((await server.inject({url:'/mcp',headers:{host:'api.example.com',authorization:'Bearer '+token,accept:'text/event-stream','mcp-protocol-version':V}})).statusCode,405);
 gate.revoke(token);
 let ended=false;for(let n=0;n<5;n++){if(await stream.next()===null){ended=true;break;}}assert(ended,'a revoked connection ends the listen stream');
 const streamed=()=>logs.filter(line=>line.mcp_method==='subscriptions/listen');
 // A stream's request log line is written once its response has finished.
 for(let attempt=0;attempt<100&&streamed().length<2;attempt++)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(streamed().length,2);assert(streamed().every(line=>line.status===200&&line.mcp_version===V));
 assert(logs.some(line=>line.event==='mcp_stream_error'&&line.cause==='unauthenticated'));
 assert(!JSON.stringify(logs).includes('Listen test'));
});
