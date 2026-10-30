import {test} from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import tls from 'node:tls';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCallbackTransport} from '../../lib/server/node/webhook-https.ts';
import {CallbackError} from '../../lib/webhook/ports.ts';

const PUBLIC='93.184.216.34';
async function receiver(t,handler){
 const directory=await mkdtemp(join(tmpdir(),'webhook-receiver-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const cert=join(directory,'cert.pem'),key=join(directory,'key.pem');
 const made=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=receiver.example.com','-addext','subjectAltName=DNS:receiver.example.com'],{stdio:'ignore'});
 assert.equal(made.status,0,'openssl certificate generation');
 const requests=[];
 const server=https.createServer({key:await readFile(key),cert:await readFile(cert)},async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;requests.push({method:req.method,url:req.url,headers:req.headers,body});handler(req,res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const ca=await readFile(cert),connects=[];
 // Stands in for the network only: the adapter's validated, pinned address is recorded and the socket reaches the fixture.
 const connect=({address,port,servername})=>{connects.push({address,port,servername});return tls.connect({host:'127.0.0.1',port:server.address().port,servername,ca,ALPNProtocols:['http/1.1']});};
 return {requests,connects,connect};
}
const body=new TextEncoder().encode('{"eventId":"evt_1"}');
const headers={'content-type':'application/json','webhook-id':'evt_1','webhook-timestamp':'1','webhook-signature':'v1,x','x-mcp-subscription-id':'sub_1'};

test('a public answer is pinned, verified against the hostname certificate and sent byte for byte',async t=>{
 const r=await receiver(t,(req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.end('{"ok":true}');});
 const transport=createCallbackTransport({resolve:async host=>{assert.equal(host,'receiver.example.com');return [PUBLIC];},connect:r.connect});
 const response=await transport('https://receiver.example.com/hooks/a?x=1',headers,body);
 assert.deepEqual(response,{status:200,body:'{"ok":true}',truncated:false});
 assert.deepEqual(r.connects,[{address:PUBLIC,port:443,servername:'receiver.example.com'}]);
 assert.equal(r.requests.length,1);const [request]=r.requests;
 assert.equal(request.url,'/hooks/a?x=1');assert.equal(request.headers.host,'receiver.example.com');assert.equal(request.body,'{"eventId":"evt_1"}');
 for(const [name,value] of Object.entries(headers))assert.equal(request.headers[name],value);
});

test('any nonpublic DNS answer, mapped address or literal rejects before a connection is opened',async t=>{
 const r=await receiver(t,(req,res)=>res.end());
 for(const answers of [[PUBLIC,'10.0.0.1'],['::ffff:127.0.0.1'],['169.254.169.254'],['fd00::1'],[]]){
  const transport=createCallbackTransport({resolve:async()=>answers,connect:r.connect});
  await assert.rejects(transport('https://receiver.example.com/h',headers,body),error=>error instanceof CallbackError&&error.reason==='endpoint_rejected',JSON.stringify(answers));
 }
 const transport=createCallbackTransport({resolve:async()=>{throw new Error('NXDOMAIN');},connect:r.connect});
 await assert.rejects(transport('https://receiver.example.com/h',headers,body),error=>error.reason==='endpoint_rejected');
 for(const url of ['https://127.0.0.1/h','https://[::1]/h','http://receiver.example.com/h','https://u:p@receiver.example.com/h'])
  await assert.rejects(createCallbackTransport({connect:r.connect})(url,headers,body),error=>error.reason==='endpoint_rejected',url);
 assert.equal(r.connects.length,0);assert.equal(r.requests.length,0);
});

test('redirects are returned without a second request and responses are bounded',async t=>{
 let mode='redirect';
 const r=await receiver(t,(req,res)=>{if(mode==='redirect'){res.writeHead(302,{location:'https://169.254.169.254/latest'});res.end();}else{res.writeHead(200);res.end('x'.repeat(10_000));}});
 const transport=createCallbackTransport({resolve:async()=>[PUBLIC],connect:r.connect});
 const redirected=await transport('https://receiver.example.com/h',headers,body);
 assert.equal(redirected.status,302);assert.equal(r.requests.length,1);assert.equal(r.connects.length,1);
 mode='large';
 const large=await transport('https://receiver.example.com/h',headers,body);
 assert.equal(large.truncated,true);assert.equal(large.body.length,4096);
});

test('a stalled callback times out and a certificate for another name is rejected',async t=>{
 const r=await receiver(t,()=>{});
 const slow=createCallbackTransport({resolve:async()=>[PUBLIC],connect:r.connect,timeoutMs:300});
 await assert.rejects(slow('https://receiver.example.com/h',headers,body),error=>error instanceof CallbackError&&error.reason==='timeout');
 const hanging=createCallbackTransport({resolve:()=>new Promise(()=>{}),connect:r.connect,timeoutMs:200});
 await assert.rejects(hanging('https://receiver.example.com/h',headers,body),error=>error.reason==='timeout');
 const wrongName=createCallbackTransport({resolve:async()=>[PUBLIC],connect:r.connect});
 await assert.rejects(wrongName('https://other.example.com/h',headers,body),error=>error instanceof CallbackError&&error.reason==='endpoint_rejected');
});
