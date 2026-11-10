import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {postgresFixture} from '../helpers/postgres.mjs';
import {createAccessAuthentication} from '../../lib/server/node/access-authentication.ts';
import {createIdentityStore} from '../../lib/adapters/postgres/identity-store.ts';
import {createServer} from '../../lib/server/node/server.ts';
import {createPostgresActionStore,cursorScope} from '../../lib/adapters/postgres/action-store.ts';
import {actionCall} from '../../lib/application/action-service.ts';

test('Access preserves owner SQL scope, separates human and AI audiences, and revalidates before commits',async t=>{
 const fixture=await postgresFixture();t.after(()=>fixture.close());
 const pair=await generateKeyPair('RS256'),jwk=await exportJWK(pair.publicKey);
 const access={issuer:'https://access.example.com',mcpAudience:'mcp-app',browserAudience:'browser-app',ownerEmail:'owner@example.com',ownerIssuer:'https://previous.example.com',ownerSubject:'original-owner'};
 const config={origin:'https://api.example.com',resource:'https://api.example.com/mcp',issuer:access.issuer,access,
  backendHosts:['backend.example.test'],spaOrigins:['https://app.example.com'],cursorEpoch:crypto.randomUUID(),writeMode:'enabled',clientWriteApproval:'auto'};
 await fixture.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3)',[access.ownerIssuer,access.ownerSubject,'existing-user']);
 const auth=createAccessAuthentication(config,createIdentityStore(fixture.pool),createLocalJWKSet({keys:[{...jwk,kid:'local'}]}));
 const server=createServer({config,authentication:auth,invoke:(principal,name,args,signal)=>actionCall({
  store:createPostgresActionStore(fixture.pool,principal,{revalidate:client=>auth.revalidate(principal,client),signal}),clock:()=>new Date().toISOString(),newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope(principal.user,config.cursorEpoch)},name,args)});
 t.after(()=>server.close());
 const token=(aud,sub='owner',email=access.ownerEmail)=>new SignJWT({email}).setProtectedHeader({alg:'RS256',kid:'local'}).setIssuer(access.issuer).setAudience(aud).setSubject(sub).setIssuedAt().setExpirationTime('5m').sign(pair.privateKey);
 const ai=await token(access.mcpAudience),browser=await token(access.browserAudience);
 const headers=jwt=>({host:'backend.example.test','cf-access-jwt-assertion':jwt,'content-type':'application/json',authorization:'Bearer gateway-iam-token'});
 const rpc=(jwt,name,args={})=>server.inject({method:'POST',url:'/mcp',headers:headers(jwt),payload:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}});
 const first=await auth.authenticate({assertion:ai,actor:'mcp'}),second=await auth.authenticate({assertion:await token(access.mcpAudience,'different-access-subject'),actor:'mcp'});
 assert.equal(first.user,'existing-user');assert.equal(first.actorKind,'client');assert.equal(first.clientId,'shared-ai');assert.equal(first.connectionId,second.connectionId);
 assert.equal((await server.inject({url:'/api/session',headers:headers(ai)})).statusCode,401);
 assert.equal((await rpc(browser,'list_actions')).statusCode,401);
 assert.equal((await server.inject({url:'/api/session',headers:{host:'backend.example.test','x-apigateway-api-userinfo':Buffer.from(JSON.stringify({email:access.ownerEmail})).toString('base64url')}})).statusCode,401);
 assert.equal((await rpc(await token(access.mcpAudience,'other','other@example.com'),'list_actions')).statusCode,403);
 const bootstrap=await server.inject({url:'/api/session',headers:headers(browser)});assert.equal(bootstrap.statusCode,200,bootstrap.body);
 const csrf=bootstrap.json().csrf_token;
 const writeHeaders={...headers(browser),origin:'https://app.example.com','x-csrf-token':csrf};
 const args={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:0,kind:'add',payload:{title:'Synthetic Access action'}};
 const write=()=>server.inject({method:'POST',url:'/api/actions',headers:writeHeaders,payload:{name:'apply_change',arguments:args}});
 const saved=await write();assert.equal(saved.statusCode,200,saved.body);assert.equal((await write()).statusCode,200);
 assert.equal((await fixture.admin.query('SELECT user_id,actor_kind,client_id FROM state.operations')).rows[0].user_id,'existing-user');
 assert.equal((await fixture.admin.query('SELECT actor_kind FROM state.operations')).rows[0].actor_kind,'user');
 assert.equal((await server.inject({method:'POST',url:'/api/actions',headers:{...writeHeaders,'x-csrf-token':'wrong'},payload:{name:'list_actions'}})).statusCode,403);
 assert.equal((await rpc(ai,'list_actions')).statusCode,200);
 await fixture.admin.query('UPDATE identity.subjects SET enabled=false WHERE user_id=$1',['existing-user']);
 await assert.rejects(auth.revalidate(first,fixture.pool),error=>error.status===403);
 assert.equal((await rpc(ai,'list_actions')).statusCode,403);
});
