import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SignJWT,exportJWK,generateKeyPair,createLocalJWKSet} from 'jose';
import {createCloudTasks,metadataAccessToken} from '../../lib/server/node/cloud-tasks.ts';
import {createTaskAuthentication} from '../../lib/server/node/task-authentication.ts';
import {ActionError} from '../../lib/domain/core.ts';

const queue='projects/example-project/locations/asia-southeast1/queues/webhooks',account='app-tasks@example-project.iam.gserviceaccount.com';

test('tasks are named HTTP targets with an OIDC token for the task identity; an existing name counts as created',async()=>{
 const calls=[];let status=200;
 const tasks=createCloudTasks({queue,origin:'https://api.example.com',serviceAccount:account,audience:'https://api.example.com/internal/webhook',token:async()=>'access',fetch:async(url,init)=>{calls.push({url,init});return new Response('{}',{status});}});
 await tasks('a'.repeat(64),'/internal/webhook-fanout',{user:'A',batchId:'wb_1',position:0});
 const [{url,init}]=calls,body=JSON.parse(init.body);
 assert.equal(url,`https://cloudtasks.googleapis.com/v2/${queue}/tasks`);assert.equal(init.headers.authorization,'Bearer access');
 assert.equal(body.task.name,`${queue}/tasks/${'a'.repeat(64)}`);
 assert.deepEqual(body.task.httpRequest.oidcToken,{serviceAccountEmail:account,audience:'https://api.example.com/internal/webhook'});
 assert.equal(body.task.httpRequest.url,'https://api.example.com/internal/webhook-fanout');
 assert.deepEqual(JSON.parse(Buffer.from(body.task.httpRequest.body,'base64').toString()),{user:'A',batchId:'wb_1',position:0});
 status=409;await tasks('b','/internal/webhook-delivery',{});
 status=503;await assert.rejects(tasks('c','/internal/webhook-delivery',{}));
 await assert.rejects(tasks('bad name','/x',{}));
 assert.throws(()=>createCloudTasks({queue:'queues/x',origin:'https://api.example.com',serviceAccount:account,audience:'a',token:async()=>'t'}));
});

test('the metadata access token is reused until shortly before it expires',async()=>{
 let now=0,requests=0;
 const token=metadataAccessToken({now:()=>now,fetch:async(url,init)=>{requests++;assert.equal(init.headers['metadata-flavor'],'Google');return new Response(JSON.stringify({access_token:'t'+requests,expires_in:3600}),{status:200});}});
 assert.equal(await token(),'t1');now=3_000_000;assert.equal(await token(),'t1');now=3_600_000;assert.equal(await token(),'t2');
});

test('only a Google-signed token for the task identity and audience authenticates a task request',async()=>{
 const {publicKey,privateKey}=await generateKeyPair('RS256'),other=await generateKeyPair('RS256');
 const keys=createLocalJWKSet({keys:[{...await exportJWK(publicKey),kid:'k',alg:'RS256'}]});
 const sign=(claims,{key=privateKey,audience='https://api.example.com/internal/webhook',issuer='https://accounts.google.com'}={})=>new SignJWT({email:account,email_verified:true,...claims}).setProtectedHeader({alg:'RS256',kid:'k'}).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime('5m').sign(key);
 const verify=createTaskAuthentication({audience:'https://api.example.com/internal/webhook',serviceAccount:account,keys});
 await verify('Bearer '+await sign({}));
 for(const [authorization,status] of [[undefined,401],['Bearer x.y.z',401],['Bearer '+await sign({},{key:other.privateKey}),401],['Bearer '+await sign({},{audience:'https://api.example.com/mcp'}),401],['Bearer '+await sign({},{issuer:'https://evil.example'}),401],['Bearer '+await sign({email:'someone@example-project.iam.gserviceaccount.com'}),403],['Bearer '+await sign({email_verified:false}),403]])
  await assert.rejects(verify(authorization),error=>error instanceof ActionError&&error.status===status,String(authorization).slice(0,20));
});
