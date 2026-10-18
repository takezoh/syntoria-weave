import https from 'node:https';
import {spawnSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
/** A real HTTPS introspection endpoint; it is not a production Gate acceptance substitute. */
export async function gateFixture({issuerHost='127.0.0.1'}={}){
 const directory=await mkdtemp(join(tmpdir(),'action-gate-'));
 const cert=join(directory,'cert.pem'),key=join(directory,'key.pem');
 if(!['127.0.0.1','gate.example.localhost'].includes(issuerHost))throw new Error('Synthetic Gate fixture host is not allowed.');
 const generated=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1,DNS:gate.example.localhost'],{stdio:'ignore'});
 if(generated.status!==0)throw new Error('Synthetic Gate TLS certificate generation failed.');
 const tokens=new Map(),sessions=new Map();let issuer,requests=0,sessionRequests=0,refreshes=0,unavailable=false;
 const server=https.createServer({key:await readFile(key),cert:await readFile(cert)},async(req,res)=>{
  res.setHeader('content-type','application/json');
  if(unavailable){res.writeHead(503);res.end('{}');return;}
  if(req.url==='/.well-known/openid-configuration'){res.end(JSON.stringify({issuer,introspection_endpoint:issuer+'/introspect',authorization_endpoint:issuer+'/auth',token_endpoint:issuer+'/token',jwks_uri:issuer+'/jwks',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256'],token_endpoint_auth_methods_supported:['none']}));return;}
  if(req.url==='/introspect'&&req.method==='POST'){
   requests++;let body='';for await(const chunk of req)body+=chunk;
   if(req.headers.authorization!=='Basic '+Buffer.from('resource:synthetic-secret').toString('base64')){res.writeHead(401);res.end('{}');return;}
   res.end(JSON.stringify(tokens.get(new URLSearchParams(body).get('token'))??{active:false}));return;
  }
  if(req.url==='/browser/session/introspect'&&req.method==='POST'){
   sessionRequests++;let body='';for await(const chunk of req)body+=chunk;
   if(req.headers.authorization!=='Basic '+Buffer.from('resource:synthetic-secret').toString('base64')){res.writeHead(401);res.end('{}');return;}
   let input;try{input=JSON.parse(body);}catch{res.writeHead(400);res.end('{}');return;}
   const record=sessions.get(input.session);
   if(!record){res.end(JSON.stringify({active:false}));return;}
   if(input.resource!==record.aud){res.writeHead(403);res.end('{}');return;}
   if(!record.active||record.exp<=Math.floor(Date.now()/1000)){res.end(JSON.stringify({active:false}));return;}
   const {active,...principal}=record;res.end(JSON.stringify({active,...principal}));return;
  }
  if(req.url==='/token'&&req.method==='POST'){
   let body='';for await(const chunk of req)body+=chunk;
   const fields=new URLSearchParams(body),refresh=fields.get('refresh_token'),record=tokens.get(refresh);
   if(fields.get('grant_type')!=='refresh_token'||!record?.active){res.writeHead(400);res.end(JSON.stringify({error:'invalid_grant'}));return;}
   refreshes++;tokens.delete(refresh);const access=randomUUID(),next=randomUUID();tokens.set(access,{...record,exp:Math.floor(Date.now()/1000)+900});tokens.set(next,record);
   res.end(JSON.stringify({access_token:access,refresh_token:next,token_type:'Bearer',expires_in:900}));return;
  }
  res.writeHead(404);res.end('{}');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));issuer='https://'+issuerHost+':'+server.address().port;
 const awaitCertificate=await readFile(cert);
 const fetcher=async(url,options={})=>new Promise((resolve,reject)=>{
  const actual=https.request(url,{method:options.method??'GET',headers:options.headers,ca:awaitCertificate,rejectUnauthorized:true,signal:options.signal},response=>{
   const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:response.statusCode,headers:response.headers})));
  });actual.on('error',reject);actual.end(options.body instanceof URLSearchParams?options.body.toString():options.body);
 });
 return {issuer,port:server.address().port,cert,tokens,sessions,fetch:fetcher,get requests(){return requests;},get sessionRequests(){return sessionRequests;},get refreshes(){return refreshes;},set unavailable(value){unavailable=value;},token({subject='person',client='test-client',audience='https://api.example.com/mcp',expiry=Math.floor(Date.now()/1000)+900,connectionId=randomUUID()}={}){const token=randomUUID();tokens.set(token,{active:true,token_type:'Bearer',gate_approved:true,iss:issuer,sub:subject,client_id:client,aud:audience,exp:expiry,connection_id:connectionId});return token;},session({subject='person',client='web',audience='https://api.example.com/mcp',expiry=Math.floor(Date.now()/1000)+900,connectionId=randomUUID(),csrfToken='synthetic-csrf'}={}){const session=randomBytes(32).toString('base64url');sessions.set(session,{active:true,iss:issuer,sub:subject,client_id:client,aud:audience,exp:expiry,connection_id:connectionId,gate_approved:true,session_type:'browser',csrf_token:csrfToken});return session;},revokeSession(value){const record=sessions.get(value);if(record)record.active=false;},async close(){await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}};
}
