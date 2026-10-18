import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import http from 'node:http';
import {createServer} from 'node:net';
import {postgresFixture} from '../../tests/helpers/postgres.mjs';
import {createIdentityStore} from '../../lib/adapters/postgres/identity-store.ts';
import {hash,sessionCookie} from '../../lib/server/node/authentication.ts';
const fixture=await postgresFixture();let child;
try{
 const listener=createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const issuer='https://issuer.test/',session=crypto.randomUUID();
 await fixture.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3)',[issuer,'built-person','built-user']);
 await fixture.admin.query('INSERT INTO identity.client_grants(issuer,subject,client_id,scopes) VALUES($1,$2,$3,$4)',[issuer,'built-person','web',['state:read','state:write']]);
 await createIdentityStore(fixture.pool).saveSession(hash(session),{issuer,subject:'built-person',clientId:'web'});
 child=spawn(process.execPath,['dist/server/index.mjs'],{env:{...process.env,NODE_ENV:'test',LOCAL_DATABASE:'true',PUBLIC_ORIGIN:'https://service.test',OAUTH_ISSUER:issuer,OAUTH_RESOURCE:'https://service.test/mcp',WEB_CLIENT_ID:'web',WEB_CLIENT_SECRET:'synthetic-secret',DATABASE_URL:fixture.url,CURSOR_EPOCH:crypto.randomUUID(),WRITE_MODE:'enabled',LOGIN_ENCRYPTION_KEY:Buffer.alloc(32,1).toString('base64url'),CSRF_KEY:Buffer.alloc(32,2).toString('base64url'),PORT:String(port)},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',chunk=>{logs+=chunk;});child.stderr.on('data',()=>{});
 const request=(path,{method='GET',body,headers={}}={})=>new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path,method,headers:{host:'service.test',...headers}},response=>{let text='';response.on('data',chunk=>{text+=chunk;});response.on('end',()=>resolve({status:response.statusCode,text}));});req.on('error',reject);req.setTimeout(3000,()=>req.destroy(new Error('HTTP timeout.')));req.end(body&&JSON.stringify(body));});
 let ready=false;for(let attempt=0;attempt<100;attempt++){if(child.exitCode!==null)throw new Error('Built service exited before readiness.');try{ready=(await request('/health/ready')).status===200;if(ready)break;}catch{}await new Promise(resolve=>setTimeout(resolve,50));}assert(ready,'Built service readiness');
 const shell=await request('/');assert.equal(shell.status,200);const asset=shell.text.match(/src="([^"]+\.js)"/)[1];assert.equal((await request(asset)).status,200);
 assert.equal((await request('/ui/widget')).status,401);
 const cookie=sessionCookie+'='+session,info=await request('/api/session',{headers:{cookie}});assert.equal(info.status,200);
 const headers={cookie,origin:'https://service.test','content-type':'application/json','x-csrf-token':JSON.parse(info.text).csrf_token};
 const args={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:0,kind:'add',payload:{title:'Built synthetic action'}};
 for(let attempt=0;attempt<2;attempt++){const result=await request('/api/actions',{method:'POST',headers,body:{name:'apply_change',arguments:args}});assert.equal(result.status,200,result.text);assert.equal(JSON.parse(result.text).revision,1);}
 const stored=await fixture.admin.query('SELECT count(*)::int AS count FROM state.actions');assert.equal(stored.rows[0].count,1);
 const widget=await request('/ui/widget',{headers:{cookie}});assert.equal(widget.status,200);assert.match(widget.text,/<!doctype html/i);
 assert(!logs.includes('Built synthetic action'));assert(!logs.includes(session));
 console.log(JSON.stringify({built_node_http_postgres:'passed',readiness:true,assets:true,session:true,csrf:true,write:true,replay:true,widget:true}));
}finally{if(child&&child.exitCode===null){const done=once(child,'exit');child.kill('SIGTERM');await done;}await fixture.close();}
