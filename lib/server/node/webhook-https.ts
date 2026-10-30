import https from 'node:https';
import tls from 'node:tls';
import {lookup} from 'node:dns/promises';
import {CallbackError,type CallbackTransport} from '../../webhook/ports';
import {isAddressLiteral,isPublicAddress,literalHost} from '../../webhook/destination';

/** Opens the TLS connection to an already validated address; the certificate is checked against `servername` when present. */
export type CallbackConnector=(options:Readonly<{address:string;port:number;servername:string|undefined}>)=>tls.TLSSocket;
const resolveAll=async(host:string)=>(await lookup(host,{all:true,verbatim:true})).map(entry=>entry.address);
const connectPinned:CallbackConnector=({address,port,servername})=>tls.connect({host:address,port,servername,ALPNProtocols:['http/1.1']});

/**
 * POSTs to a public HTTPS callback. Every DNS answer must be public; the connection is pinned to a validated address, so a
 * later lookup cannot redirect it. Redirects are returned, never followed, and no proxy is consulted.
 */
export function createCallbackTransport({resolve=resolveAll,connect=connectPinned,timeoutMs=5_000,maxResponseBytes=4_096}:{
 resolve?:(host:string)=>Promise<readonly string[]>;connect?:CallbackConnector;timeoutMs?:number;maxResponseBytes?:number;
}={}):CallbackTransport {
 return async(target,headers,body)=>{
  const deadline=Date.now()+timeoutMs;
  let url:URL;try{url=new URL(target);}catch{throw new CallbackError('endpoint_rejected');}
  if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new CallbackError('endpoint_rejected');
  const host=literalHost(url.hostname),literal=isAddressLiteral(host);
  let timer:ReturnType<typeof setTimeout>|undefined;
  const addresses=literal?[host]:await Promise.race([resolve(host),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new CallbackError('timeout')),timeoutMs);})])
   .catch(error=>{throw error instanceof CallbackError?error:new CallbackError('endpoint_rejected');}).finally(()=>clearTimeout(timer));
  if(!addresses.length||!addresses.every(isPublicAddress))throw new CallbackError('endpoint_rejected');
  const address=addresses[0]!,port=Number(url.port||443);
  return await new Promise((resolve,reject)=>{
   let settled=false;
   const finish=(value:{status:number;body:string;truncated:boolean}|CallbackError)=>{if(settled)return;settled=true;clearTimeout(expiry);if(value instanceof CallbackError)reject(value);else resolve(value);};
   // Without an agent, Node uses createConnection alone: no pooled socket, proxy or second lookup.
   const request=https.request({method:'POST',hostname:url.hostname,port,path:url.pathname+url.search,
    headers:{...headers,host:url.host,'content-length':String(body.length)},
    createConnection:()=>connect({address,port,servername:literal?undefined:host})},response=>{
    const chunks:Buffer[]=[];let size=0;
    const done=(truncated:boolean)=>finish({status:response.statusCode??0,body:Buffer.concat(chunks).toString('utf8'),truncated});
    response.on('data',(chunk:Buffer)=>{
     if(settled)return;
     if(size+chunk.length>maxResponseBytes){chunks.push(chunk.subarray(0,maxResponseBytes-size));size=maxResponseBytes;done(true);response.destroy();return;}
     chunks.push(chunk);size+=chunk.length;
    });
    response.on('end',()=>done(false));
    response.on('error',()=>finish(new CallbackError('endpoint_rejected')));
   });
   const expiry=setTimeout(()=>{finish(new CallbackError('timeout'));request.destroy();},Math.max(0,deadline-Date.now()));
   request.on('error',()=>finish(new CallbackError('endpoint_rejected')));
   request.end(body);
  });
 };
}
