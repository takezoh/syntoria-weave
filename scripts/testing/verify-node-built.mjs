import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import http from 'node:http';
import net from 'node:net';
import {createServer} from 'node:net';
import {postgresFixture} from '../../tests/helpers/postgres.mjs';
import {gateFixture} from '../../tests/helpers/gate.mjs';
import {sessionCookie} from '../../lib/server/node/authentication.ts';

const fixture=await postgresFixture(),gate=await gateFixture({issuerHost:'gate.example.localhost'});let child;
const apiOrigin='https://api.example.localhost',appOrigin='https://app.example.localhost',resource=apiOrigin+'/mcp',parent='example.localhost';
try{
 const listener=createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const browser=gate.session({subject:'built-person',client:'web',audience:resource}),bearer=gate.token({subject:'built-person',client:'mcp',audience:resource});
 await fixture.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3)',[gate.issuer,'built-person','built-user']);
 for(const client of ['web','mcp'])await fixture.admin.query('INSERT INTO identity.client_grants(issuer,subject,client_id,scopes) VALUES($1,$2,$3,$4)',[gate.issuer,'built-person',client,['state:read','state:write']]);
 child=spawn(process.execPath,['dist/server/index.mjs'],{env:{...process.env,NODE_OPTIONS:[process.env.NODE_OPTIONS,'--import='+new URL('./local-gate-fetch.mjs',import.meta.url).pathname].filter(Boolean).join(' '),GATE_TEST_LOOPBACK_PORT:String(gate.port),NODE_ENV:'test',LOCAL_DATABASE:'true',PUBLIC_ORIGIN:apiOrigin,OAUTH_ISSUER:gate.issuer,OAUTH_RESOURCE:resource,SHARED_COOKIE_DOMAIN:parent,SPA_ORIGINS:JSON.stringify([appOrigin]),GATE_BROWSER_CLIENT_ID:'web',GATE_RESOURCE_CLIENT_ID:'resource',GATE_RESOURCE_CLIENT_SECRET:'synthetic-secret',GATE_ALLOWED_CLIENT_IDS:'web,mcp',NODE_EXTRA_CA_CERTS:gate.cert,DATABASE_URL:fixture.url,CURSOR_EPOCH:crypto.randomUUID(),WRITE_MODE:'enabled',PORT:String(port)},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',chunk=>{logs+=chunk;});child.stderr.on('data',()=>{});
 const request=(path,{method='GET',body,headers={}}={})=>new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path,method,headers:{host:'api.example.localhost',...headers}},response=>{let text='';response.on('data',chunk=>{text+=chunk;});response.on('end',()=>resolve({status:response.statusCode,text,headers:response.headers}));});req.on('error',reject);req.setTimeout(3000,()=>req.destroy(new Error('HTTP timeout.')));req.end(body&&JSON.stringify(body));});
 const rawHttp=(raw)=>new Promise((resolve,reject)=>{const socket=net.connect(port,'127.0.0.1');let response='';socket.setTimeout(3000,()=>socket.destroy(new Error('Raw HTTP timeout.')));socket.on('connect',()=>socket.write(raw));socket.on('data',chunk=>{response+=chunk.toString('latin1');});socket.on('error',reject);socket.on('end',()=>resolve(Number(response.match(/^HTTP\/1\.[01] (\d{3})/m)?.[1])));});
 let ready=false;for(let attempt=0;attempt<100;attempt++){if(child.exitCode!==null)throw new Error('Built service exited before readiness.');try{ready=(await request('/health/ready')).status===200;if(ready)break;}catch{}await new Promise(resolve=>setTimeout(resolve,50));}assert(ready,'Built service readiness');
 assert.equal((await request('/')).status,404);assert.equal((await request('/assets/app.js')).status,404);assert.equal((await request('/ui/widget')).status,404);assert.equal((await request('/runtime-config.json')).status,404);
 const cookie=sessionCookie+'='+browser,info=await request('/api/session',{headers:{cookie}});assert.equal(info.status,200,info.text);assert.match(info.text,/"account_scope":"[0-9a-f]{64}"/);const csrf=JSON.parse(info.text).csrf_token;
 const preflight=await request('/api/actions',{method:'OPTIONS',headers:{origin:appOrigin,'access-control-request-method':'POST','access-control-request-headers':'content-type, x-csrf-token'}});assert.equal(preflight.status,204);assert.equal(preflight.headers['access-control-allow-origin'],appOrigin);assert.equal(preflight.headers['access-control-allow-credentials'],'true');
 const body=JSON.stringify({name:'list_actions'}),length=Buffer.byteLength(body),cookieLine='Cookie: '+cookie+'\r\n';
 assert.equal(await rawHttp('GET /api/session HTTP/1.1\r\nHost: api.example.localhost\r\n'+cookieLine+'Authorization: Bearer '+bearer+'\r\nAuthorization: Bearer '+bearer+'\r\nConnection: close\r\n\r\n'),401);
 assert.equal(await rawHttp('OPTIONS /api/actions HTTP/1.1\r\nHost: api.example.localhost\r\nOrigin: '+appOrigin+'\r\nOrigin: https://other-app.example.localhost\r\nAccess-Control-Request-Method: POST\r\nConnection: close\r\n\r\n'),403);
 assert.equal(await rawHttp('POST /api/actions HTTP/1.1\r\nHost: api.example.localhost\r\n'+cookieLine+'Origin: '+appOrigin+'\r\nContent-Type: application/json\r\nX-CSRF-Token: '+csrf+'\r\nX-CSRF-Token: '+csrf+'\r\nContent-Length: '+length+'\r\nConnection: close\r\n\r\n'+body),403);
 const args={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:0,kind:'add',payload:{title:'Built synthetic action'}};
 for(let attempt=0;attempt<2;attempt++){const result=await request('/api/actions',{method:'POST',headers:{cookie,origin:appOrigin,'content-type':'application/json','x-csrf-token':csrf},body:{name:'apply_change',arguments:args}});assert.equal(result.status,200,result.text);assert.equal(JSON.parse(result.text).revision,1);}
 assert.equal((await fixture.admin.query('SELECT count(*)::int AS count FROM state.actions')).rows[0].count,1);assert.equal((await fixture.admin.query('SELECT count(*)::int AS count FROM identity.sessions')).rows[0].count,0);
 const mcp=await request('/mcp',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+bearer},body:{jsonrpc:'2.0',id:1,method:'tools/list'}});assert.equal(mcp.status,200,mcp.text);assert(Array.isArray(JSON.parse(mcp.text).result.tools));
 assert.equal((await request('/api/session',{headers:{authorization:'Bearer '+bearer}})).status,401);
 gate.revokeSession(browser);assert.equal((await request('/api/session',{headers:{cookie}})).status,401);
 const unavailable=gate.session({subject:'built-person',client:'web',audience:resource});gate.unavailable=true;
 try{assert.equal((await request('/api/session',{headers:{cookie:sessionCookie+'='+unavailable}})).status,503);}finally{gate.unavailable=false;}
 assert(!logs.includes('Built synthetic action'));assert(!logs.includes(browser));assert(!logs.includes(bearer));
 console.log(JSON.stringify({built_node_http_postgres:'passed',readiness:true,api_only:true,session:true,csrf:true,raw_duplicate_headers:true,write:true,replay:true,mcp_bearer:true,revocation:true,outage:true}));
}finally{if(child&&child.exitCode===null){const done=once(child,'exit');child.kill('SIGTERM');await done;}await fixture.close();await gate.close();}
