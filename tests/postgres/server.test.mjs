import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {gateFixture} from '../helpers/gate.mjs';
import {postgresFixture} from '../helpers/postgres.mjs';
import {createAuthentication,createGateVerification,sessionCookie,cookieValue} from '../../lib/server/node/authentication.ts';
import {createIdentityStore} from '../../lib/adapters/postgres/identity-store.ts';
import {createServer} from '../../lib/server/node/server.ts';
import {createPostgresActionStore,cursorScope,userLockKey} from '../../lib/adapters/postgres/action-store.ts';
import {actionCall} from '../../lib/application/action-service.ts';
import {verifyPrincipal} from '../../lib/server/node/principal.ts';
import {readConfig} from '../../lib/server/node/config.ts';

function rawHttp(port,request){
 return new Promise((resolve,reject)=>{
  const socket=net.connect(port,'127.0.0.1');let response='';
  socket.setTimeout(3000,()=>socket.destroy(new Error('Raw HTTP timeout.')));
  socket.on('connect',()=>socket.write(request));
  socket.on('data',chunk=>{response+=chunk.toString('latin1');});
  socket.on('error',reject);
  socket.on('end',()=>resolve(Number(response.match(/^HTTP\/1\.[01] (\d{3})/m)?.[1])));
 });
}

test('Node HTTP/MCP validates shared sessions online and retains bearer OAuth for MCP',async t=>{
 const f=await postgresFixture();t.after(()=>f.close());
 const gate=await gateFixture();t.after(()=>gate.close());
 const config={origin:'https://api.example.com',issuer:gate.issuer,resource:'https://api.example.com/mcp',browserClientId:'web',spaOrigins:['https://app.example.com','https://other-app.example.com'],sharedCookieDomain:'example.com',gateClientId:'resource',gateClientSecret:'synthetic-secret',databaseUrl:f.url,cursorEpoch:crypto.randomUUID(),writeMode:'enabled',clientWriteApproval:'auto',port:8080,localDatabase:true};
 const verification=createGateVerification(config,{fetch:gate.fetch});
 const identityStore=createIdentityStore(f.pool),auth=createAuthentication(config,identityStore,verification);
 const bearer=gate.token({client:'mcp'}),browser=gate.session({client:'web'}),cookie=sessionCookie+'='+browser;
 await f.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3)',[config.issuer,'person','user']);
 await f.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3)',[config.issuer,'other-person','other-user']);
 const logs=[];const server=createServer({config,authentication:auth,log:value=>logs.push(value),invoke:(principal,name,args,signal)=>actionCall({store:createPostgresActionStore(f.pool,principal,{revalidate:client=>auth.revalidate(principal,client),signal}),clock:()=>new Date().toISOString(),newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope(principal.user,config.cursorEpoch)},name,args)});
 t.after(()=>server.close());
 const address=await server.listen({host:'127.0.0.1',port:0});const port=Number(new URL(address).port);
 const base={host:'api.example.com','content-type':'application/json'};
 const rpc=(method,params={},extra={})=>server.inject({method:'POST',url:'/mcp',headers:{...base,authorization:'Bearer '+bearer,...extra},payload:{jsonrpc:'2.0',id:1,method,params}});
 const readSession=(session=browser,extra={})=>server.inject({url:'/api/session',headers:{host:'api.example.com',cookie:sessionCookie+'='+session,...extra}});
 const browserWrite=(session,csrf,origin='https://app.example.com',args={name:'list_actions'})=>{
  const headers={...base,cookie:sessionCookie+'='+session,'x-csrf-token':csrf};if(origin)headers.origin=origin;
  return server.inject({method:'POST',url:'/api/actions',headers,payload:args});
 };

 assert.equal((await f.admin.query("SELECT to_regclass('identity.client_grants') IS NULL AS absent")).rows[0].absent,true);

 await t.test('API host and route split retain protocol-owned MCP UI resources',async()=>{
  const meta=await server.inject({url:'/.well-known/oauth-protected-resource/mcp',headers:base});assert.equal(meta.statusCode,200);assert.equal(meta.json().resource,config.resource);
  assert.equal(meta.headers['strict-transport-security'],'max-age=31536000');
  assert.equal((await server.inject({url:'/health/live'})).statusCode,200);
  assert.equal((await server.inject({url:'/',headers:base})).statusCode,404);
  assert.equal((await server.inject({url:'/assets/app.js',headers:base})).statusCode,404);
  assert.equal((await server.inject({url:'/auth/login',headers:base})).statusCode,404);
  assert.equal((await server.inject({url:'/ui/widget',headers:base})).statusCode,404);
  assert.equal((await server.inject({url:'/',headers:{host:'attacker.example.com'}})).statusCode,403);
  const openActions=(await rpc('tools/list')).json().result.tools.find(tool=>tool.name==='open_actions');
  assert.equal(openActions.title,'Syntoria Weave');
  assert.deepEqual(openActions._meta['openai/ui'].entrypoints,[{type:'global'},{type:'thread'}]);
  assert.equal(openActions._meta['openai/outputTemplate'],'ui://action-tools/actions-v4.html');
  assert.equal((await rpc('resources/list')).json().result.resources.some(resource=>resource.uri==='ui://action-tools/actions-v4.html'),true);
  const resource=(await rpc('resources/read',{uri:'ui://action-tools/actions-v4.html'})).json().result.contents[0];
  assert.equal(resource.mimeType,'text/html;profile=mcp-app');
  assert.deepEqual(resource._meta['openai/ui'].availableDisplayModes,['inline','fullscreen']);
  assert.equal(resource._meta['openai/widgetDescription'],'Structured actions: normal, deferred, completed, details and safe editing.');
 });

 await t.test('exact credentialed CORS and bounded preflight reject other origins, methods, headers and routes',async()=>{
  const preflight=await server.inject({method:'OPTIONS',url:'/api/actions',headers:{host:'api.example.com',origin:'https://app.example.com','access-control-request-method':'POST','access-control-request-headers':'content-type, x-csrf-token'}});
  assert.equal(preflight.statusCode,204);assert.equal(preflight.headers['access-control-allow-origin'],'https://app.example.com');assert.equal(preflight.headers['access-control-allow-credentials'],'true');
  assert.match(preflight.headers.vary,/Origin/);assert.match(preflight.headers.vary,/Access-Control-Request-Method/);assert.equal(preflight.headers['access-control-allow-headers'],'content-type, x-csrf-token');
  const denied=await server.inject({method:'OPTIONS',url:'/api/actions',headers:{host:'api.example.com',origin:'https://attacker.example.com','access-control-request-method':'POST'}});assert.equal(denied.statusCode,403);assert.equal(denied.headers['access-control-allow-origin'],undefined);
  assert.equal((await server.inject({method:'OPTIONS',url:'/api/actions',headers:{host:'api.example.com',origin:'https://app.example.com','access-control-request-method':'GET'}})).statusCode,403);
  assert.equal((await server.inject({method:'OPTIONS',url:'/api/actions',headers:{host:'api.example.com',origin:'https://app.example.com','access-control-request-method':'POST','access-control-request-headers':'authorization'}})).statusCode,403);
  assert.equal((await server.inject({method:'OPTIONS',url:'/api/unknown',headers:{host:'api.example.com',origin:'https://app.example.com','access-control-request-method':'GET'}})).statusCode,404);
  assert.equal((await rpc('tools/list',{}, {origin:'https://attacker.example.com'})).statusCode,403);
 });

 await t.test('real HTTP ingress rejects duplicate security headers before Fastify normalization',async()=>{
  const body=JSON.stringify({name:'list_actions'}),length=Buffer.byteLength(body),cookieLine='Cookie: '+sessionCookie+'='+browser+'\r\n';
  const authorization=await rawHttp(port,'GET /api/session HTTP/1.1\r\nHost: api.example.com\r\n'+cookieLine+'Authorization: Bearer '+bearer+'\r\nAuthorization: Bearer '+bearer+'\r\nConnection: close\r\n\r\n');
  assert.equal(authorization,401);
  const origins=await rawHttp(port,'OPTIONS /api/actions HTTP/1.1\r\nHost: api.example.com\r\nOrigin: https://app.example.com\r\nOrigin: https://attacker.example.com\r\nAccess-Control-Request-Method: POST\r\nConnection: close\r\n\r\n');
  assert.equal(origins,403);
  const csrf=await rawHttp(port,'POST /api/actions HTTP/1.1\r\nHost: api.example.com\r\n'+cookieLine+'Origin: https://app.example.com\r\nContent-Type: application/json\r\nX-CSRF-Token: synthetic-csrf\r\nX-CSRF-Token: synthetic-csrf\r\nContent-Length: '+length+'\r\nConnection: close\r\n\r\n'+body);
  assert.equal(csrf,403);
  const contentType=await rawHttp(port,'POST /api/actions HTTP/1.1\r\nHost: api.example.com\r\n'+cookieLine+'Origin: https://app.example.com\r\nContent-Type: application/json\r\nContent-Type: text/plain\r\nX-CSRF-Token: synthetic-csrf\r\nContent-Length: '+length+'\r\nConnection: close\r\n\r\n'+body);
  assert.equal(contentType,400);
 });

 await t.test('browser session is cookie-only, resource-bound, expiry checked and never persisted in Weave',async()=>{
  const before=gate.sessionRequests;
  const info=await readSession();assert.equal(info.statusCode,200,info.body);assert.equal(info.json().csrf_token,'synthetic-csrf');assert.match(info.json().account_scope,/^[0-9a-f]{64}$/);assert.equal(gate.sessionRequests,before+1);
  assert.equal((await server.inject({url:'/api/session',headers:{...base,authorization:'Bearer '+bearer}})).statusCode,401);
  assert.equal((await readSession(browser,{origin:'https://attacker.example.com'})).statusCode,403);
  const malformed=Buffer.from('bad').toString('base64url');const calls=gate.sessionRequests;
  assert.equal((await readSession(malformed)).statusCode,401);assert.equal(gate.sessionRequests,calls);
  assert.equal((await readSession(browser,{authorization:'Bearer '+bearer})).statusCode,401);
  assert.equal((await readSession(browser,{cookie:cookie+'; '+sessionCookie+'=other'})).statusCode,401);
  assert.equal((await readSession(browser,{authorization:['Bearer '+bearer,'Bearer '+bearer]})).statusCode,401);
  const wrongBrowserClient=gate.session({client:'mcp'});assert.equal((await readSession(wrongBrowserClient)).statusCode,401);
  const wrongAudience=gate.session({audience:'https://other.example.com/mcp'});assert.equal((await readSession(wrongAudience)).statusCode,503);
  const expired=gate.session({expiry:Math.floor(Date.now()/1000)-1});assert.equal((await readSession(expired)).statusCode,401);
  gate.revokeSession(browser);assert.equal((await readSession()).statusCode,401);
  assert.equal((await f.admin.query('SELECT count(*)::int AS count FROM identity.sessions')).rows[0].count,0);
 });

 await t.test('browser writes require registered Origin and Gate CSRF; replay is exact and account scoped',async()=>{
  const first=gate.session({subject:'person',client:'web'}),second=gate.session({subject:'other-person',client:'web'}),secondInfo=await readSession(second);assert.equal(secondInfo.statusCode,200);
  const args={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:0,kind:'add',payload:{title:'Browser direct API write'}};
  const payload={name:'apply_change',arguments:args};
  assert.equal((await browserWrite(second,'synthetic-csrf',null,payload)).statusCode,403);
  assert.equal((await browserWrite(second,'wrong','https://app.example.com',payload)).statusCode,403);
  assert.equal((await browserWrite(second,'synthetic-csrf','https://attacker.example.com',payload)).statusCode,403);
  const saved=await browserWrite(second,'synthetic-csrf','https://app.example.com',payload);assert.equal(saved.statusCode,200,saved.body);assert.equal(saved.json().revision,1);
  const replay=await browserWrite(second,'synthetic-csrf','https://app.example.com',payload);assert.equal(replay.statusCode,200,replay.body);assert.equal(replay.json().revision,1);
  const accountOne=await readSession(first),accountTwo=await readSession(second);assert.notEqual(accountOne.json().account_scope,accountTwo.json().account_scope);
  assert.equal((await f.admin.query('SELECT count(*)::int AS count FROM state.actions WHERE user_id=$1',['user'])).rows[0].count,0);
  assert.equal((await f.admin.query('SELECT count(*)::int AS count FROM state.actions WHERE user_id=$1',['other-user'])).rows[0].count,1);
  assert.deepEqual((await f.admin.query('SELECT actor_kind FROM state.operations WHERE user_id=$1',['other-user'])).rows,[{actor_kind:'user'}]);
 });

 await t.test('MCP retains bearer authorization-code resource semantics and rejects cookies',async()=>{
  assert.equal((await server.inject({method:'POST',url:'/mcp',headers:{...base,authorization:'Bearer '+bearer,cookie},payload:{jsonrpc:'2.0',id:1,method:'tools/list'}})).statusCode,401);
  assert.equal((await server.inject({method:'POST',url:'/mcp',headers:{...base,'oai-authenticated-user-id':'user','oai-authenticated-user-email':'person@example.invalid'},payload:{jsonrpc:'2.0',id:1,method:'tools/list'}})).statusCode,401);
  assert.equal((await rpc('initialize',{protocolVersion:'2025-11-25'})).json().result.protocolVersion,'2025-11-25');
  assert.equal((await rpc('tools/list')).json().result.tools.some(value=>value.name==='apply_change'),true);
  const args={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:0,kind:'add',payload:{title:'MCP remains independent'}};
  const call=()=>rpc('tools/call',{name:'apply_change',arguments:args});
  assert.equal((await call()).json().result.structuredContent.revision,1);assert.equal((await call()).json().result.structuredContent.revision,1);
  assert.deepEqual((await f.admin.query('SELECT actor_kind FROM state.operations WHERE user_id=$1',['user'])).rows,[{actor_kind:'client'}]);
  assert.equal((await server.inject({method:'POST',url:'/api/actions',headers:{...base,authorization:'Bearer '+bearer},payload:{name:'list_actions'}})).json().actions[0].title,'MCP remains independent');
  assert.equal((await rpc('notifications/initialized')).statusCode,202);
  assert.equal((await rpc('ping',{}, {'mcp-protocol-version':'future'})).statusCode,400);
  const dynamicClient=await rpc('tools/list',{}, {authorization:'Bearer '+gate.token({client:'dcr-client-43'})});assert.equal(dynamicClient.statusCode,200,dynamicClient.body);
  const inconsistentClient=gate.token({client:'dcr-client-44'});gate.tokens.get(inconsistentClient).azp='different-client';
  assert.equal((await rpc('tools/list',{}, {authorization:'Bearer '+inconsistentClient})).statusCode,401);
  const azpOnlyClient=gate.token({client:'dcr-client-45'}),azpOnlyRecord=gate.tokens.get(azpOnlyClient);delete azpOnlyRecord.client_id;azpOnlyRecord.azp='dcr-client-45';
  assert.equal((await rpc('tools/list',{}, {authorization:'Bearer '+azpOnlyClient})).statusCode,401);
  assert.equal((await rpc('tools/list',{}, {authorization:'Bearer '+gate.token({subject:'unmapped-person',client:'another-dcr-client'})})).statusCode,403);
 });

 await t.test('collaboration crosses MCP, browser decisions and the same PostgreSQL revision without new grants',async()=>{
  const read=await rpc('tools/call',{name:'list_collaborations',arguments:{}}),before=read.json().result.structuredContent;
  const args={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:before.revision,action_id:null,proposal:{title:'Suggested work',instructions:'Original request',scope:'Draft only',outcome:'A draft',exclusions:'No external sending',source:'AI suggestion'}};
  const proposed=(await rpc('tools/call',{name:'propose_collaboration',arguments:args})).json().result.structuredContent;
  assert.equal(proposed.collaborations.length,1);assert.equal(proposed.actions.length,before.actions.length);
  const decision={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:proposed.revision,id:proposed.result.collaboration_id,command:'adopt',payload:{version:1},action_id:null,delegate:true};
  const activeSession=gate.session({client:'web'});
  assert.equal((await browserWrite(activeSession,'wrong','https://app.example.com',{name:'update_collaboration',arguments:decision})).statusCode,403);
  const adopted=(await browserWrite(activeSession,'synthetic-csrf','https://app.example.com',{name:'update_collaboration',arguments:decision})).json();
  assert.equal(adopted.actions.length,before.actions.length+1);assert.equal(adopted.collaborations[0].progress,'not_started');
  const started=(await rpc('tools/call',{name:'update_collaboration',arguments:{...decision,operationId:crypto.randomUUID(),expectedRevision:adopted.revision,command:'start',action_id:undefined,delegate:undefined}})).json().result.structuredContent;
  assert.equal(started.collaborations[0].progress,'running');
  const report={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:started.revision,id:decision.id,command:'report',payload:{version:1,run_id:started.collaborations[0].run_id,summary:'Draft ready',remaining:'User must send',outcome:'success',artifacts:[]}};
  const reported=(await rpc('tools/call',{name:'update_collaboration',arguments:report})).json().result.structuredContent;
  assert.equal(reported.actions.find(row=>row.id===reported.collaborations[0].action_id).status,'active');
  assert.deepEqual((await rpc('tools/call',{name:'update_collaboration',arguments:report})).json().result.structuredContent.result,reported.result);
  const history=(await rpc('tools/call',{name:'get_collaboration',arguments:{id:decision.id}})).json().result.structuredContent.history;
  assert.equal(history.find(row=>row.command==='adopt').actor.kind,'user');assert.equal(history.find(row=>row.command==='propose').actor.kind,'client');
 });

 await t.test('client connection writes pass the approval policy while the person needs none',async()=>{
  const operations=async()=>(await f.admin.query('SELECT actor_kind FROM state.operations WHERE user_id=$1 ORDER BY revision_after',['user'])).rows.map(row=>row.actor_kind);
  const before=await operations();
  config.clientWriteApproval='blocked';
  try{
   const args={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:before.length,kind:'add',payload:{title:'Client write under a blocking policy'}};
   const denied=await rpc('tools/call',{name:'apply_change',arguments:args});
   assert.equal(denied.statusCode,403,denied.body);assert.equal(denied.json().error,'client_write_denied');
   const deniedHttp=await server.inject({method:'POST',url:'/api/actions',headers:{...base,authorization:'Bearer '+bearer},payload:{name:'apply_change',arguments:args}});
   assert.equal(deniedHttp.statusCode,403);assert.equal(deniedHttp.json().error,'client_write_denied');
   assert.equal((await rpc('tools/call',{name:'list_actions',arguments:{}})).statusCode,200);
   assert.deepEqual(await operations(),before);
   const person=gate.session({subject:'person',client:'web'});
   const revision=(await browserWrite(person,'synthetic-csrf','https://app.example.com',{name:'list_actions'})).json().revision;
   const saved=await browserWrite(person,'synthetic-csrf','https://app.example.com',{name:'apply_change',arguments:{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:revision,kind:'add',payload:{title:'The person writes without approval'}}});
   assert.equal(saved.statusCode,200,saved.body);
   assert.deepEqual(await operations(),[...before,'user']);
  }finally{config.clientWriteApproval='auto';}
  const approved=await rpc('tools/call',{name:'apply_change',arguments:{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:before.length+1,kind:'add',payload:{title:'Client write approved automatically'}}});
  assert.equal(approved.json().result.structuredContent.revision,before.length+2,approved.body);
  assert.deepEqual(await operations(),[...before,'user','client']);
 });

 await t.test('Gate and subject mapping are rechecked online inside locked writes',async()=>{
  await f.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3)',[config.issuer,'lock-person','lock-user']);
  const owner=gate.session({subject:'lock-person'});
  const locked=await f.admin.connect();await locked.query('BEGIN');await locked.query('SELECT pg_advisory_xact_lock($1::bigint)',[userLockKey('lock-user')]);
  let pending;
  try{
   pending=browserWrite(owner,'synthetic-csrf','https://app.example.com',{name:'apply_change',arguments:{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:0,kind:'add',payload:{title:'Revoked while waiting'}}});
   let waiting=false;for(let attempt=0;attempt<100;attempt++){waiting=!!(await f.admin.query("SELECT 1 FROM pg_stat_activity WHERE wait_event='advisory' AND pid<>pg_backend_pid()")).rowCount;if(waiting)break;await new Promise(resolve=>setTimeout(resolve,5));}assert(waiting,'browser mutation must wait for its user lock');
   gate.revokeSession(owner);await locked.query('COMMIT');
   const result=(await pending).json();assert.equal(result.error,'unauthenticated');
   assert.equal((await f.admin.query('SELECT count(*)::int AS count FROM state.operations WHERE user_id=$1',['lock-user'])).rows[0].count,0);
  }finally{await locked.query('ROLLBACK');locked.release();await pending;}

  const subjectLock=await f.admin.connect();await subjectLock.query('BEGIN');await subjectLock.query('SELECT pg_advisory_xact_lock($1::bigint)',[userLockKey('lock-user')]);
  const subjectSession=gate.session({subject:'lock-person'});let subjectPending;
  try{
   subjectPending=browserWrite(subjectSession,'synthetic-csrf','https://app.example.com',{name:'apply_change',arguments:{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:0,kind:'add',payload:{title:'Subject disabled while waiting'}}});
   let waiting=false;for(let attempt=0;attempt<100;attempt++){waiting=!!(await f.admin.query("SELECT 1 FROM pg_stat_activity WHERE wait_event='advisory' AND pid<>pg_backend_pid()")).rowCount;if(waiting)break;await new Promise(resolve=>setTimeout(resolve,5));}assert(waiting);
   await f.admin.query('UPDATE identity.subjects SET enabled=false WHERE issuer=$1 AND subject=$2',[config.issuer,'lock-person']);
   await subjectLock.query('COMMIT');assert.equal((await subjectPending).json().error,'forbidden');
  }finally{await subjectLock.query('ROLLBACK');subjectLock.release();await subjectPending;await f.admin.query('UPDATE identity.subjects SET enabled=true WHERE issuer=$1 AND subject=$2',[config.issuer,'lock-person']);}
 });

 await t.test('Gate outage fails closed and online verification is not cached',async()=>{
  const active=gate.session(),before=gate.sessionRequests;
  assert.equal((await readSession(active)).statusCode,200);assert.equal((await readSession(active)).statusCode,200);assert.equal(gate.sessionRequests,before+2);
  const calls=gate.requests;assert.equal((await rpc('tools/list')).statusCode,200);assert.equal((await rpc('tools/list')).statusCode,200);assert.equal(gate.requests,calls+2);
  gate.unavailable=true;
  try{
   assert.equal((await readSession(active)).statusCode,503);
   assert.equal((await browserWrite(active,'synthetic-csrf')).statusCode,503);
   assert.equal((await rpc('tools/list')).statusCode,503);
  }finally{gate.unavailable=false;}
  gate.revokeSession(active);assert.equal((await readSession(active)).statusCode,401);
 });

 await t.test('logs and cookie parsing do not expose credentials or caller data',async()=>{
  const text=JSON.stringify(logs);for(const secret of [bearer,browser,'synthetic-csrf','Browser direct API write','person'])assert(!text.includes(secret));
  assert.equal((await f.admin.query('SELECT count(*)::int AS count FROM identity.sessions')).rows[0].count,0);
  assert.throws(()=>verifyPrincipal({user:'user'}),error=>error.code==='unauthenticated');
  assert.throws(()=>cookieValue(sessionCookie+'=a; '+sessionCookie+'=b',sessionCookie),error=>error.code==='unauthenticated');
 });
});

test('configuration binds API, Gate issuer and SPA origins to an explicit shared cookie parent',()=>{
 assert.throws(()=>readConfig({}),/Missing configuration/);
 const env={PUBLIC_ORIGIN:'https://api.example.com',OAUTH_ISSUER:'https://gate.example.com',OAUTH_RESOURCE:'https://api.example.com/mcp',GATE_BROWSER_CLIENT_ID:'web',SPA_ORIGINS:'["https://app.example.com"]',SHARED_COOKIE_DOMAIN:'example.com',GATE_RESOURCE_CLIENT_ID:'resource',GATE_RESOURCE_CLIENT_SECRET:'secret',DATABASE_URL:'postgresql://user:secret@db.example.com/db',CURSOR_EPOCH:crypto.randomUUID()};
 assert.equal(readConfig(env).writeMode,'blocked');
 assert.equal(readConfig(env).clientWriteApproval,'auto');
 assert.equal(readConfig({...env,CLIENT_WRITE_APPROVAL:'blocked'}).clientWriteApproval,'blocked');
 assert.throws(()=>readConfig({...env,CLIENT_WRITE_APPROVAL:'gate'}),/CLIENT_WRITE_APPROVAL/);
 assert.throws(()=>readConfig({...env,PUBLIC_ORIGIN:'http://api.example.com'}));
 assert.throws(()=>readConfig({...env,PUBLIC_ORIGIN:'https://api.example.com/path'}));
 assert.throws(()=>readConfig({...env,OAUTH_ISSUER:'https://gate.other.test'}));
 assert.throws(()=>readConfig({...env,OAUTH_RESOURCE:'https://other.example.com/mcp'}));
 assert.throws(()=>readConfig({...env,SHARED_COOKIE_DOMAIN:'example.com/'}));
 assert.throws(()=>readConfig({...env,SPA_ORIGINS:'["https://app.example.com","https://app.example.com"]'}));
 assert.throws(()=>readConfig({...env,SPA_ORIGINS:'["http://app.example.com"]'}));
 assert.equal('allowedClientIds' in readConfig(env),false);
 assert.throws(()=>readConfig({...env,LOCAL_DATABASE:'true',NODE_ENV:'production'}));
});
