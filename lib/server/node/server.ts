import type {McpSubscriptions} from './mcp-subscriptions';
import type {ChangePage} from '../../data/model/change-cursor';
import {mcpEventStream} from './mcp-event-stream';
import Fastify from 'fastify';
import {ActionError,fail} from '../../domain/core';
import {dispatchMcp} from '../../mcp/dispatcher';
import {authorize,type Principal} from './principal';
import {cookieValue,sessionCookie,type Authentication} from './authentication';
import type {ServiceConfig} from './config';

export type Invoke=(identity:Principal,name:string,args:unknown,signal:AbortSignal,observe:(phase:'pool_wait'|'sql',ms:number)=>void)=>Promise<unknown>;

const preflightHeaders=new Set(['content-type','x-csrf-token']);
const apiMethods:Readonly<Record<string,readonly string[]>>=Object.freeze({
 '/api/session':['GET'],
 '/api/actions':['POST'],
});

function oneHeader(value:string|string[]|undefined,name:string){
 if(Array.isArray(value)){
  if(value.length!==1)fail('forbidden','Ambiguous '+name+' header.',403);
  return value[0];
 }
 return value;
}

function authorizationHeader(value:string|string[]|undefined){
 if(Array.isArray(value)&&value.length!==1)fail('unauthenticated','Ambiguous Authorization header.',401);
 return Array.isArray(value)?value[0]:value;
}

const uniqueWireHeaders:Readonly<Record<string,{code:'unauthenticated'|'forbidden'|'invalid_input';status:number}>>=Object.freeze({
 authorization:{code:'unauthenticated',status:401},
 cookie:{code:'unauthenticated',status:401},
 origin:{code:'forbidden',status:403},
 'x-csrf-token':{code:'forbidden',status:403},
 'content-type':{code:'invalid_input',status:400},
 host:{code:'forbidden',status:403},
 'last-event-id':{code:'invalid_input',status:400},
 'access-control-request-method':{code:'forbidden',status:403},
 'access-control-request-headers':{code:'forbidden',status:403},
});

function rejectDuplicateWireHeaders(rawHeaders:readonly string[]){
 const seen=new Set<string>();
 for(let index=0;index<rawHeaders.length;index+=2){
  const name=rawHeaders[index]!.toLowerCase(),policy=uniqueWireHeaders[name];
  if(!policy)continue;
  if(seen.has(name))fail(policy.code,'Ambiguous '+name+' header.',policy.status);
  seen.add(name);
 }
}

function requestOrigin(value:string|string[]|undefined){
 const origin=oneHeader(value,'Origin');
 if(origin!==undefined&&origin.length===0)fail('forbidden','Origin is not allowed.',403);
 return origin;
}

function jsonContentType(value:string|string[]|undefined){
 const contentType=oneHeader(value,'Content-Type');
 return typeof contentType==='string'&&contentType.split(';',1)[0]!.trim().toLowerCase()==='application/json';
}

function setVary(reply:{header(name:string,value:string):unknown},value:string){
 // Fastify appends repeated Vary values and preserves existing values.
 reply.header('Vary',value);
}

export function createServer({config,authentication,invoke,subscriptions,log=()=>{}}:{
 config:ServiceConfig;subscriptions?:McpSubscriptions;authentication:Authentication;invoke:Invoke;log?:(value:Record<string,unknown>)=>void;
}){
 const stats=new WeakMap<object,{pool_wait:number;sql:number}>();
 const app=Fastify({logger:false,bodyLimit:1_048_576,requestTimeout:20_000,connectionTimeout:30_000,trustProxy:false});
 const apiHost=new URL(config.origin).host;
 const streams=new Map<string,number>(),streamControllers=new Set<AbortController>();let streamCount=0;
 app.addHook('preClose',async()=>{for(const controller of streamControllers)controller.abort();});

 app.addHook('onRequest',async(req,reply)=>{
  stats.set(req,{pool_wait:0,sql:0});
  reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Strict-Transport-Security','max-age=31536000');
  const {raw: rawRequest}=req;
  rejectDuplicateWireHeaders(rawRequest.rawHeaders);
  const pathname=req.url.split('?',1)[0]!;
  if(pathname.startsWith('/health/'))return;
  if(req.headers.host!==apiHost)fail('forbidden','Untrusted Host.',403);
  const origin=requestOrigin(req.headers.origin);
  if(pathname.startsWith('/api/')){
   if(origin!==undefined){
    if(!config.spaOrigins.includes(origin))fail('forbidden','Origin is not allowed.',403);
    reply.header('Access-Control-Allow-Origin',origin).header('Access-Control-Allow-Credentials','true');
    setVary(reply,req.method==='OPTIONS'?'Origin, Access-Control-Request-Method, Access-Control-Request-Headers':'Origin');
   }
  }else if(pathname==='/mcp'&&origin!==undefined&&origin!==config.origin){
   fail('forbidden','Origin is not allowed.',403);
  }
  if(req.method==='POST'&&['/mcp','/api/actions'].includes(pathname)&&!jsonContentType(req.headers['content-type']))return reply.code(415).send({error:'invalid_input'});
 });

 app.addHook('onResponse',async(req,reply)=>{log({request_id:req.id,route:req.routeOptions.url??'unknown',status:reply.statusCode,duration_ms:reply.elapsedTime,pool_wait_ms:stats.get(req)?.pool_wait??0,sql_ms:stats.get(req)?.sql??0});});
 app.setErrorHandler((error,req,reply)=>{
  const known=error instanceof ActionError;
  const status=known?error.status:(error as {statusCode?:number}).statusCode??503;
  const code=known?error.code:status===413?'operation_too_large':status===400?'invalid_input':status===415?'invalid_input':'outcome_unknown';
  if(status===401||code==='insufficient_scope')reply.header('WWW-Authenticate',`Bearer resource_metadata="${config.origin}/.well-known/oauth-protected-resource/mcp"`);
  reply.code(status).send({error:code,message:known?error.message:'Request failed. Retain the exact request if a write may have started.'});
 });

 function identity(req:{headers:Record<string,string|string[]|undefined>},write:boolean){
  const authorization=authorizationHeader(req.headers.authorization);
  return authentication.authenticate({authorization,cookie:req.headers.cookie,csrf:oneHeader(req.headers['x-csrf-token'],'X-CSRF-Token'),origin:requestOrigin(req.headers.origin)},write);
 }

 function browserIdentity(req:{headers:Record<string,string|string[]|undefined>}){
  if(authorizationHeader(req.headers.authorization)!==undefined||cookieValue(req.headers.cookie,sessionCookie)===null)fail('unauthenticated','Browser session is required.',401);
  return identity(req,false);
 }

 async function run(req:object,principal:Principal,name:string,args:unknown){
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([invoke(principal,name,args,controller.signal,(phase,ms)=>{const value=stats.get(req);if(value)value[phase]+=ms;}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new ActionError('outcome_unknown','The request deadline elapsed; retain the exact request.',503));},20_000);})]);}finally{clearTimeout(timer);}
 }

 const metadata={resource:config.resource,authorization_servers:[config.issuer],bearer_methods_supported:['header']};
 for(const route of ['/.well-known/oauth-protected-resource/mcp','/.well-known/oauth-protected-resource'])app.get(route,async()=>metadata);
 app.get('/health/live',async()=>({status:'ok'}));app.get('/health/ready',async()=>({status:'ready'}));

 for(const [route,methods] of Object.entries(apiMethods))app.options(route,async(req,reply)=>{
  const origin=requestOrigin(req.headers.origin);
  if(!origin||!config.spaOrigins.includes(origin))fail('forbidden','Origin is not allowed.',403);
  const requestedMethod=oneHeader(req.headers['access-control-request-method'],'Access-Control-Request-Method');
  if(!requestedMethod||!methods.includes(requestedMethod.toUpperCase()))fail('forbidden','Preflight method is not allowed.',403);
  const requestedHeaders=oneHeader(req.headers['access-control-request-headers'],'Access-Control-Request-Headers');
  const headers=requestedHeaders?requestedHeaders.split(',').map(value=>value.trim().toLowerCase()).filter(Boolean):[];
  if(headers.some(value=>!preflightHeaders.has(value)))fail('forbidden','Preflight header is not allowed.',403);
  reply.header('Access-Control-Allow-Origin',origin).header('Access-Control-Allow-Credentials','true')
   .header('Access-Control-Allow-Methods',methods.join(', '))
   .header('Access-Control-Allow-Headers',headers.join(', '));
  setVary(reply,'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  return reply.code(204).send();
 });

 app.get('/api/session',async(req)=>{
  const p=await browserIdentity(req);authorize(p,'list_actions',config);return authentication.sessionInfo(p);
 });
 app.post('/api/actions',async(req)=>{
  if(!jsonContentType(req.headers['content-type']))fail('invalid_input','Expected application/json.',415);
  const p=await identity(req,true),body=req.body as {name?:unknown;arguments?:unknown};
  if(!body||typeof body.name!=='string'||Object.keys(body).some(key=>!['name','arguments'].includes(key)))fail('invalid_input','Expected name and arguments.');
  authorize(p,body.name,config);return run(req,p,body.name,body.arguments??{});
 });
 app.post('/mcp',async(req,reply)=>{
  if(req.headers.cookie)fail('unauthenticated','MCP requires bearer authentication.',401);
  const principal=await identity(req,false);authorize(principal,'list_actions',config);
  const version=oneHeader(req.headers['mcp-protocol-version'],'MCP-Protocol-Version');if(version&&!['2025-03-26','2025-06-18','2025-11-25'].includes(version))fail('invalid_input','Unsupported MCP protocol version.');
  const body=req.body as {method?:string;params?:{name?:string}};if(body?.method==='tools/call'&&typeof body.params?.name==='string')authorize(principal,body.params.name,config);
  const result=await dispatchMcp(req.body,async(name,args)=>{authorize(principal,name,config);return run(req,principal,name,args);},principal.scopes.includes('state:write'),subscriptions?{set:(resource,subscribed)=>subscriptions.set(principal,resource,subscribed)}:undefined);
  return result.body===null?reply.code(result.status).send():reply.code(result.status).send(result.body);
 });
 app.get('/mcp',async(req,reply)=>{
  if(!subscriptions)return reply.header('Allow','POST').code(405).send();
  if(req.headers.cookie)fail('unauthenticated','MCP requires bearer authentication.',401);
  if(!String(req.headers.accept??'').split(',').some(part=>part.trim().split(';')[0]==='text/event-stream'))fail('invalid_input','Accept text/event-stream to receive MCP notifications.',406);
  const version=oneHeader(req.headers['mcp-protocol-version'],'MCP-Protocol-Version');if(version&&!['2025-03-26','2025-06-18','2025-11-25'].includes(version))fail('invalid_input','Unsupported MCP protocol version.');
  const principal=await identity(req,false);authorize(principal,'list_actions',config);
  if(!(await subscriptions.list(principal)).length)fail('invalid_state','Subscribe to action-state://current or action-state://assigned before opening the event stream.',409);
  if(streamCount>=64||(streams.get(principal.user)??0)>=4)fail('unavailable','Too many active event streams. Reconnect later.',429);
  const cursor=oneHeader(req.headers['last-event-id'],'Last-Event-ID')??(await run(req,principal,'get_change_cursor',{}) as {cursor:string}).cursor;
  const initial=await run(req,principal,'get_changes',{cursor}) as ChangePage;
  if(streamCount>=64||(streams.get(principal.user)??0)>=4)fail('unavailable','Too many active event streams. Reconnect later.',429);
  const controller=new AbortController();streamControllers.add(controller);let closed=false;
  const close=()=>{if(closed)return;closed=true;controller.abort();streamControllers.delete(controller);streamCount--;const count=(streams.get(principal.user)??1)-1;if(count)streams.set(principal.user,count);else streams.delete(principal.user);};
  streamCount++;streams.set(principal.user,(streams.get(principal.user)??0)+1);const {raw:rawReply}=reply;rawReply.once('close',close);
  const stream=mcpEventStream(initial,{
   // Revalidate the connection before every subscription check; a changed identity ends the stream.
   subscriptions:async()=>{const current=await identity(req,false);authorize(current,'list_actions',config);return current.user===principal.user&&current.connectionId===principal.connectionId?await subscriptions.list(current):[];},
   poll:async current=>await run(req,principal,'get_changes',{cursor:current}) as ChangePage,
   assigned:async()=>{const value=await run(req,principal,'list_assigned_collaborations',{}) as {items:unknown[]};return JSON.stringify(value.items);},
  },{signal:controller.signal});
  stream.once('close',close);reply.header('Content-Type','text/event-stream').header('X-Accel-Buffering','no');return reply.send(stream);
 });
 app.delete('/mcp',async(_req,reply)=>reply.header('Allow',subscriptions?'POST, GET':'POST').code(405).send());
 return app;
}
