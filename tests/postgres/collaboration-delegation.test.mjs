import http from 'node:http';
import {Readable} from 'node:stream';
import {setTimeout as delay} from 'node:timers/promises';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {postgresFixture} from '../helpers/postgres.mjs';
import {gateFixture} from '../helpers/gate.mjs';
import {createServer} from '../../lib/server/node/server.ts';
import {createMcpSubscriptions} from '../../lib/adapters/postgres/mcp-subscriptions.ts';
import {createAuthentication,createGateVerification,sessionCookie} from '../../lib/server/node/authentication.ts';
import {createIdentityStore} from '../../lib/adapters/postgres/identity-store.ts';
import {createPostgresActionStore,cursorScope} from '../../lib/adapters/postgres/action-store.ts';
import {migrate,grantRuntime,checkRuntime} from '../../lib/adapters/postgres/migrations.ts';
import {issuePrincipal} from '../../lib/server/node/principal.ts';
import {actionCall} from '../../lib/application/action-service.ts';
const streamRequest=(url,{headers,signal})=>new Promise((resolve,reject)=>{const req=http.get(url,{headers,signal},res=>resolve({status:res.statusCode,headers:new Headers(res.headers),body:Readable.toWeb(res)}));req.on('error',reject);});
const now='2026-10-29T09:00:00.000Z';

test('migration 0011 states any AI for existing collaboration records and keeps subscriptions on the shared state',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'action-delegation-'));
 for(const file of (await readdir('db/postgres/migrations')).filter(name=>name<'0011'))await copyFile(join('db/postgres/migrations',file),join(directory,file));
 const f=await postgresFixture({migrations:directory});t.after(async()=>{await f.close();await rm(directory,{recursive:true,force:true});});
 const identity=user=>issuePrincipal({user,issuer:'test',subject:user,connectionId:'c-'+user,clientId:'client-'+user,actorKind:'client',scopes:['state:read','state:write']});
 const proposal={title:'Reply',instructions:'Keep "delegation": as written\0\ud800 😀',scope:'Draft',outcome:'A draft',exclusions:'',source:'Test'};
 const actionId='00000000-0000-4000-8000-000000000001',collaborationId='00000000-0000-4000-8000-000000000002';
 // Populate the 0010 schema with a record exactly as the previous release stored it.
 const legacy={id:collaborationId,action_id:actionId,revision:2,version:1,proposal,decision:'accepted',progress:'not_started',next_actor:'ai',feedback:'',summary:'',remaining:'',outcome:'none',artifacts:[],run_id:null,run_actor:null,stop_requested:false,action_revision:1,created_at:now,updated_at:now,last_reported_at:null};
 const body=JSON.stringify(legacy),delta=JSON.stringify({actions:[],projects:[],tags:[],perspectives:[],action_tags:[]});
 await f.admin.query(`INSERT INTO state.actions(user_id,id,title,notes,metadata,revision,parent_id,project_id,status,due_at,defer_until,"order",flagged,created_at,updated_at) VALUES('A',$1,'"Reply"','""','""',1,NULL,NULL,'active',NULL,NULL,0,false,$2,$2)`,[actionId,now]);
 await f.admin.query("INSERT INTO state.operations(user_id,operation_id,canonical_payload,result,delta,revision_before,revision_after,undo_of,created_at) VALUES('A','00000000-0000-4000-8000-000000000101','{}',$1,$2,0,1,NULL,$3),('A','00000000-0000-4000-8000-000000000102','{}',$4,$2,1,2,NULL,$3)",[JSON.stringify({operationId:'00000000-0000-4000-8000-000000000101',revision:1,changedIds:[actionId]}),delta,now,JSON.stringify({operationId:'00000000-0000-4000-8000-000000000102',revision:2,changedIds:[],collaboration_id:collaborationId})]);
 await f.admin.query("INSERT INTO state.collaborations(user_id,id,action_id,revision,body) VALUES('A',$1,$2,2,$3)",[collaborationId,actionId,body]);
 await f.admin.query("INSERT INTO state.collaboration_history(user_id,operation_id,collaboration_id,revision,command,actor,body,canonical_payload,result,delta) VALUES('A','00000000-0000-4000-8000-000000000102',$1,2,'request',$2,$3,'{}',$4,$5)",[collaborationId,JSON.stringify({kind:'user',client_id:'app',connection_id:'app-1'}),body,JSON.stringify({operationId:'00000000-0000-4000-8000-000000000102',revision:2,changedIds:[],collaboration_id:collaborationId}),delta]);
 await f.admin.query("INSERT INTO state.mcp_subscriptions(user_id,connection_id,expires_at) VALUES('A','c-A',now()+interval '1 hour')");
 await migrate(f.admin,resolve('db/postgres/migrations'));await grantRuntime(f.admin,'action_runtime');await checkRuntime(f.pool);
 const store=createPostgresActionStore(f.pool,identity('A')),record=(await store.readSnapshot()).collaborations[0];
 assert.deepEqual(record,{delegation:{mode:'any_ai',client_id:null},...legacy});
 assert.equal(record.proposal.instructions,proposal.instructions,'stored text is untouched by the splice');
 assert.deepEqual((await store.readCollaborationHistory(collaborationId,null))[0].record.delegation,{mode:'any_ai',client_id:null});
 assert.deepEqual((await createMcpSubscriptions(f.pool).list(identity('A'))),['action-state://current']);
 const listed=await actionCall({store,clock:()=>now,newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope('A','epoch')},'list_assigned_collaborations',{});
 assert.deepEqual(listed.items.map(item=>[item.reason,item.collaboration.id]),[['open_to_any_ai',collaborationId]]);
});

test('delegation is shared state any actor sets; each connection finds and is notified only of its own work',async t=>{
 const f=await postgresFixture();t.after(()=>f.close());const gate=await gateFixture();t.after(()=>gate.close());
 const config={origin:'https://api.example.com',issuer:gate.issuer,resource:'https://api.example.com/mcp',browserClientId:'web',spaOrigins:['https://app.example.com'],sharedCookieDomain:'example.com',gateClientId:'resource',gateClientSecret:'synthetic-secret',databaseUrl:f.url,cursorEpoch:crypto.randomUUID(),writeMode:'enabled',clientWriteApproval:'auto',port:8080,localDatabase:true};
 await f.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3),($1,$4,$5)',[gate.issuer,'person','A','other','B']);
 const auth=createAuthentication(config,createIdentityStore(f.pool),createGateVerification(config,{fetch:gate.fetch}));
 const server=createServer({config,authentication:auth,subscriptions:createMcpSubscriptions(f.pool),invoke:(principal,name,args,signal)=>actionCall({store:createPostgresActionStore(f.pool,principal,{signal,revalidate:c=>auth.revalidate(principal,c)}),clock:()=>new Date().toISOString(),newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope(principal.user,config.cursorEpoch)},name,args)});
 t.after(()=>server.close());const address=await server.listen({host:'127.0.0.1',port:0});
 const one=gate.token({client:'ai-one',name:'AI One'}),two=gate.token({client:'ai-two',name:'AI Two'}),other=gate.token({subject:'other',client:'ai-one',name:'AI One'}),session=gate.session();
 const rpc=async(method,params,bearer)=>{const r=await server.inject({method:'POST',url:'/mcp',headers:{host:'api.example.com','content-type':'application/json',authorization:'Bearer '+bearer},payload:{jsonrpc:'2.0',id:1,method,params}});assert.equal(r.statusCode,200,r.body);return r.json();};
 const tool=async(bearer,name,args={})=>{const result=(await rpc('tools/call',{name,arguments:args},bearer)).result;assert.equal(result.isError,undefined,JSON.stringify(result));return result.structuredContent;};
 const write=async(bearer,name,args)=>tool(bearer,name,{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:(await tool(bearer,'list_actions')).revision,...args});
 const browser=async(name,args)=>{const r=await server.inject({method:'POST',url:'/api/actions',headers:{host:'api.example.com','content-type':'application/json',cookie:sessionCookie+'='+session,origin:'https://app.example.com','x-csrf-token':'synthetic-csrf'},payload:{name,arguments:args}});assert.equal(r.statusCode,200,r.body);return r.json();};
 const personWrite=async(name,args)=>browser(name,{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:(await browser('list_actions',{})).revision,...args});
 const reasons=async bearer=>(await tool(bearer,'list_assigned_collaborations')).items.map(item=>item.reason);
 const proposal={title:'Draft reply',instructions:'Draft only',scope:'Prepare a draft',outcome:'A draft',exclusions:'No sending',source:'Test'};

 const action=(await personWrite('apply_change',{kind:'add',payload:{title:'Reply to Ken'}})).result.resolved.actions[0].id;
 const proposed=await write(two,'propose_collaboration',{action_id:action,proposal,delegation:{mode:'specified_ai',client_id:'ai-one'}});const key=proposed.result.collaboration_id;
 assert.deepEqual(await browser('list_assigned_collaborations',{}).then(value=>value.items.map(item=>[item.reason,item.collaboration.id])),[['waiting_on_you',key]],'unapproved work is the person\'s');
 assert.deepEqual(await reasons(one),[]);

 await rpc('resources/subscribe',{uri:'action-state://assigned'},one);
 assert.equal((await rpc('resources/subscribe',{uri:'action-state://unknown'},one)).error.code,-32601);
 const abort=new AbortController();t.after(()=>abort.abort());
 const response=await streamRequest(address+'/mcp',{headers:{host:'api.example.com',authorization:'Bearer '+one,accept:'text/event-stream'},signal:abort.signal});assert.equal(response.status,200);
 const reader=response.body.getReader();let buffer='';
 async function nextNotification(ms=8000){const deadline=Date.now()+ms;while(Date.now()<deadline){let end;while((end=buffer.indexOf('\n\n'))!==-1){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=block.split('\n').find(line=>line.startsWith('data: '));if(data)return JSON.parse(data.slice(6));}const part=await Promise.race([reader.read(),delay(Math.max(1,deadline-Date.now())).then(()=>null)]);if(!part)return null;if(part.done)return null;buffer+=new TextDecoder().decode(part.value);}return null;}
 const initial=await nextNotification();assert.equal(initial.params.uri,'action-state://assigned');

 const unrelated=await personWrite('apply_change',{kind:'add',payload:{title:'Unrelated'}});
 await delay(2500);
 const approved=await personWrite('update_collaboration',{id:key,command:'accept',payload:{version:1}});
 const event=await nextNotification();assert.equal(event.params.uri,'action-state://assigned');
 assert.equal(event.params._meta.revision,approved.revision,'the unrelated change at revision '+unrelated.revision+' sent no assigned notification');
 assert.deepEqual(JSON.parse((await rpc('resources/read',{uri:'action-state://assigned'},one)).result.contents[0].text).items.map(item=>[item.reason,item.collaboration.delegation]),[['assigned_to_you',{mode:'specified_ai',client_id:'ai-one'}]]);
 assert.deepEqual(await reasons(two),[],'work specified for another AI is not listed as open');

 // Nothing is enforced: the other AI may start the work and may change the target.
 const started=await write(two,'update_collaboration',{id:key,command:'start',payload:{version:1}});
 const run=started.collaborations.find(row=>row.id===key);assert.equal(run.run_actor.client_id,'ai-two');
 assert.deepEqual(await reasons(two),['your_run']);
 const reassigned=await write(two,'update_collaboration',{id:key,command:'assign',payload:{version:1,delegation:{mode:'any_ai'}}});
 assert.deepEqual(await reasons(one),[]);
 let moved;do{moved=await nextNotification();assert(moved,'losing the assignment notifies this connection');}while(moved.params._meta.revision<reassigned.revision);
 assert.equal(moved.params.uri,'action-state://assigned');
 const history=(await tool(one,'get_collaboration',{id:key})).history;
 assert.deepEqual(history.map(entry=>[entry.command,entry.actor.client_id,entry.record.delegation.mode]),[['assign','ai-two','any_ai'],['start','ai-two','specified_ai'],['accept','web','specified_ai'],['propose','ai-two','specified_ai']]);
 assert.deepEqual((await tool(other,'list_assigned_collaborations')).items,[],'another user sees nothing');
 await rpc('resources/unsubscribe',{uri:'action-state://assigned'},one);
 assert.equal((await server.inject({url:'/mcp',headers:{host:'api.example.com',authorization:'Bearer '+one,accept:'text/event-stream'}})).statusCode,409);
});
