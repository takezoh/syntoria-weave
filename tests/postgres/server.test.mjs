import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {postgresFixture} from '../helpers/postgres.mjs';
import {createAuthentication,createTokenVerifier,hash,csrfToken,sessionCookie,cookieValue} from '../../lib/server/node/authentication.ts';
import {createIdentityStore} from '../../lib/adapters/postgres/identity-store.ts';
import {createServer} from '../../lib/server/node/server.ts';
import {createPostgresActionStore,cursorScope,userLockKey} from '../../lib/adapters/postgres/action-store.ts';
import {actionCall} from '../../lib/application/action-service.ts';
import {authorize,verifyPrincipal} from '../../lib/server/node/principal.ts';
import {readConfig} from '../../lib/server/node/config.ts';
test('Node HTTP/MCP uses verified JWT/session identity and real PostgreSQL',async t=>{
 const f=await postgresFixture();t.after(()=>f.close());
 const config={origin:'https://service.test',issuer:'https://issuer.test/',resource:'https://service.test/mcp',webClientId:'web',webClientSecret:'not-a-real-secret',databaseUrl:f.url,cursorEpoch:crypto.randomUUID(),writeMode:'enabled',port:8080,localDatabase:true,loginKey:Buffer.alloc(32,1),csrfKey:Buffer.alloc(32,2)};
 const keys=await generateKeyPair('RS256'),jwk={...await exportJWK(keys.publicKey),kid:'test'};
 const verify=createTokenVerifier(config,createLocalJWKSet({keys:[jwk]}));
 const identityStore=createIdentityStore(f.pool),auth=createAuthentication(config,identityStore,verify);
 const token=async({subject='person',scope='state:read state:write',audience=config.resource,expiry='15m',client='test-client'}={})=>new SignJWT({scope,azp:client}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer(config.issuer).setSubject(subject).setAudience(audience).setIssuedAt().setExpirationTime(expiry).sign(keys.privateKey);
 await f.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3)',[config.issuer,'person','user']);
 for(const client of ['test-client','web'])await f.admin.query('INSERT INTO identity.client_grants(issuer,subject,client_id,scopes) VALUES($1,$2,$3,$4)',[config.issuer,'person',client,['state:read','state:write']]);
 const logs=[];const server=createServer({config,authentication:auth,webHtml:'<html>Actions</html>',log:value=>logs.push(value),invoke:(principal,name,args,signal)=>actionCall({store:createPostgresActionStore(f.pool,principal,{revalidate:client=>auth.revalidate(principal,client),signal}),clock:()=>new Date().toISOString(),newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope(principal.user,config.cursorEpoch)},name,args)});
 t.after(()=>server.close());
 const headers={host:'service.test','content-type':'application/json'};
 const bearer=await token();
 const rpc=(method,params={},extra={})=>server.inject({method:'POST',url:'/mcp',headers:{...headers,authorization:'Bearer '+bearer,...extra},payload:{jsonrpc:'2.0',id:1,method,params}});
 await t.test('public metadata, bad hosts, missing/forged/wrong-audience/expired tokens',async()=>{
  const meta=await server.inject({url:'/.well-known/oauth-protected-resource/mcp',headers});assert.equal(meta.statusCode,200);assert.equal(meta.json().resource,config.resource);
  assert.equal((await server.inject({url:'/',headers:{host:'attacker.test'}})).statusCode,403);
  const missing=await server.inject({method:'POST',url:'/mcp',headers,payload:{}});assert.equal(missing.statusCode,401);assert.match(missing.headers['www-authenticate'],/resource_metadata/);
  for(const bad of ['fake',await token({audience:'https://other.test'}),await token({expiry:Math.floor(Date.now()/1000)-120})])assert.equal((await rpc('tools/list',{}, {authorization:'Bearer '+bad})).statusCode,401);
 });
 await t.test('authenticated discovery and write/read/replay run through the shared adapter',async()=>{
  assert.equal((await rpc('initialize',{protocolVersion:'2025-11-25'})).json().result.protocolVersion,'2025-11-25');
  assert.equal((await rpc('tools/list')).json().result.tools.some(x=>x.name==='apply_change'),true);
  const args={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:0,kind:'add',payload:{title:'Only this user'}};
  const saved=(await rpc('tools/call',{name:'apply_change',arguments:args})).json().result.structuredContent;assert.equal(saved.revision,1);
  assert.equal((await rpc('tools/call',{name:'apply_change',arguments:args})).json().result.structuredContent.revision,1);
  const read=await server.inject({method:'POST',url:'/api/actions',headers:{...headers,authorization:'Bearer '+bearer},payload:{name:'list_actions'}});assert.equal(read.json().actions[0].title,'Only this user');
  assert.equal((await rpc('notifications/initialized')).statusCode,202);
  assert.equal((await rpc('ping',{}, {'mcp-protocol-version':'future'})).statusCode,400);
 });
 await t.test('read scope cannot mutate, scope revocation and client binding are enforced',async()=>{
  const readOnly=await token({scope:'state:read'});
  assert.equal((await rpc('tools/list',{}, {authorization:'Bearer '+readOnly})).json().result.tools.some(x=>x.name==='apply_change'),false);
  assert.equal((await rpc('tools/call',{name:'apply_change',arguments:{}},{authorization:'Bearer '+readOnly})).statusCode,403);
  assert.equal((await rpc('tools/list',{}, {authorization:'Bearer '+await token({client:'unregistered'})})).statusCode,403);
  await f.admin.query('UPDATE identity.client_grants SET enabled=false WHERE client_id=$1',['test-client']);
  assert.equal((await rpc('tools/list')).statusCode,403);
  await f.admin.query('UPDATE identity.client_grants SET enabled=true WHERE client_id=$1',['test-client']);
 });
 await t.test('grant revocation while waiting for user lock prevents the commit',async()=>{
  const locked=await f.admin.connect();await locked.query('BEGIN');await locked.query('SELECT pg_advisory_xact_lock($1::bigint)',[userLockKey('user')]);
  let pending;
  try{
   pending=rpc('tools/call',{name:'apply_change',arguments:{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:1,kind:'add',payload:{title:'Revoked while waiting'}}});
   // Fastify inject is lazy; start the request before observing the actual database lock wait.
   pending=Promise.resolve(pending);
   let waiting=false;for(let attempt=0;attempt<100;attempt++){waiting=!!(await f.admin.query("SELECT 1 FROM pg_stat_activity WHERE wait_event='advisory' AND pid<>pg_backend_pid()")).rowCount;if(waiting)break;await new Promise(resolve=>setTimeout(resolve,5));}assert(waiting,'write must wait for the user lock');
   await f.admin.query('UPDATE identity.client_grants SET enabled=false WHERE client_id=$1',['test-client']);
   await locked.query('COMMIT');const result=(await pending).json().result;assert.equal(result.structuredContent.error.code,'forbidden');
   assert.equal((await f.admin.query('SELECT count(*)::int AS count FROM state.operations')).rows[0].count,1);
  }finally{await locked.query('ROLLBACK');locked.release();await pending;await f.admin.query('UPDATE identity.client_grants SET enabled=true WHERE client_id=$1',['test-client']);}
 });
 await t.test('Web session enforces CSRF, Origin, mixed-credential rejection and logout',async()=>{
  const session=crypto.randomUUID(),cookie=sessionCookie+'='+session;await identityStore.saveSession(hash(session),{issuer:config.issuer,subject:'person',clientId:'web'});
  const info=await server.inject({url:'/api/session',headers:{host:'service.test',cookie}});assert.equal(info.statusCode,200);assert.equal(info.json().csrf_token,csrfToken(config.csrfKey,session));
  const payload={name:'list_actions'};
  assert.equal((await server.inject({method:'POST',url:'/api/actions',headers:{...headers,cookie,origin:config.origin},payload})).statusCode,403);
  const csrf={'x-csrf-token':info.json().csrf_token};
  assert.equal((await server.inject({method:'POST',url:'/api/actions',headers:{...headers,...csrf,cookie,origin:'https://attacker.test'},payload})).statusCode,403);
  assert.equal((await server.inject({method:'POST',url:'/api/actions',headers:{...headers,...csrf,cookie,origin:config.origin},payload})).statusCode,200);
  assert.equal((await server.inject({method:'POST',url:'/api/actions',headers:{...headers,...csrf,cookie,authorization:'Bearer '+bearer},payload})).statusCode,401);
  assert.equal((await server.inject({method:'POST',url:'/auth/logout',headers:{...headers,...csrf,cookie,origin:config.origin},payload:{}})).statusCode,200);
  assert.equal((await server.inject({url:'/api/session',headers:{host:'service.test',cookie}})).statusCode,401);
 });
 await t.test('one-time login state is bound to browser; expired state never reaches provider',async()=>{
  await identityStore.saveLogin({state_hash:hash('state'),binding_hash:hash('browser'),verifier:'encrypted',nonce:'nonce',return_to:'/',channel:'channel'});
  assert.equal(await identityStore.consumeLogin(hash('state'),hash('wrong')),null);
  assert.ok(await identityStore.consumeLogin(hash('state'),hash('browser')));
  assert.equal(await identityStore.consumeLogin(hash('state'),hash('browser')),null);
  await assert.rejects(auth.finishLogin(new URL(config.origin+'/auth/callback?state=missing'),'__Host-action_login=browser'),e=>e.code==='unauthenticated');
 });
 await t.test('no content, credentials or personal identifiers enter transport logs',()=>{
  const text=JSON.stringify(logs);for(const secret of [bearer,'Only this user','test-client','person'])assert(!text.includes(secret));
  assert.throws(()=>verifyPrincipal({user:'user'}),e=>e.code==='unauthenticated');
  assert.throws(()=>cookieValue('__Host-action_session=a; __Host-action_session=b',sessionCookie),e=>e.code==='unauthenticated');
 });
});
test('configuration fails closed on TLS, resource mismatch, keys and unsafe local exceptions',()=>{
 assert.throws(()=>readConfig({}),/Missing configuration/);
 const env={PUBLIC_ORIGIN:'https://service.test',OAUTH_ISSUER:'https://issuer.test/',OAUTH_RESOURCE:'https://service.test/mcp',WEB_CLIENT_ID:'web',WEB_CLIENT_SECRET:'secret',DATABASE_URL:'postgresql://user:secret@db.test/db',CURSOR_EPOCH:crypto.randomUUID(),LOGIN_ENCRYPTION_KEY:Buffer.alloc(32).toString('base64url'),CSRF_KEY:Buffer.alloc(32).toString('base64url')};
 assert.equal(readConfig(env).writeMode,'blocked');assert.throws(()=>readConfig({...env,PUBLIC_ORIGIN:'http://service.test'}));assert.throws(()=>readConfig({...env,OAUTH_RESOURCE:'https://other.test/mcp'}));assert.throws(()=>readConfig({...env,LOCAL_DATABASE:'true',NODE_ENV:'production'}));
 assert.throws(()=>authorize({user:'forged'},'list_actions','enabled'),e=>e.code==='unauthenticated');
});
