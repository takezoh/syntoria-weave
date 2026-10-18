import Fastify from 'fastify';
import {ActionError,fail} from '../../domain/core';
import {dispatchMcp} from '../../mcp/dispatcher';
import {widgetHtml} from '../../widget';
import {authorize,type Principal} from './principal';
import type {Authentication} from './authentication';
import type {ServiceConfig} from './config';
export type Invoke=(identity:Principal,name:string,args:unknown,signal:AbortSignal,observe:(phase:'pool_wait'|'sql',ms:number)=>void)=>Promise<unknown>;
export function createServer({config,authentication,invoke,webHtml,assets=new Map(),log=()=>{}}:{
 config:ServiceConfig;authentication:Authentication;invoke:Invoke;webHtml:string;assets?:ReadonlyMap<string,string>;log?:(value:Record<string,unknown>)=>void;
}){
 const stats=new WeakMap<object,{pool_wait:number;sql:number}>();
 const app=Fastify({logger:false,bodyLimit:1_048_576,requestTimeout:20_000,connectionTimeout:30_000,trustProxy:false});
 app.addHook('onRequest',async(req,reply)=>{
  stats.set(req,{pool_wait:0,sql:0});
  reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff');
  if(req.url.startsWith('/health/'))return;
  if(req.headers.host!==new URL(config.origin).host)fail('forbidden','Untrusted Host.',403);
  if(req.method==='POST'&&['/mcp','/api/actions'].includes(req.url.split('?')[0])&&!String(req.headers['content-type']??'').toLowerCase().startsWith('application/json'))return reply.code(415).send({error:'invalid_input'});
  if(req.headers.origin&&req.headers.origin!==config.origin)fail('forbidden','Origin is not allowed.',403);
 });
 app.addHook('onResponse',async(req,reply)=>{log({request_id:req.id,route:req.routeOptions.url??'unknown',status:reply.statusCode,duration_ms:reply.elapsedTime,pool_wait_ms:stats.get(req)?.pool_wait??0,sql_ms:stats.get(req)?.sql??0});});
 app.setErrorHandler((error,req,reply)=>{
  const known=error instanceof ActionError;
  const status=known?error.status:(error as {statusCode?:number}).statusCode??503;
  const code=known?error.code:status===413?'operation_too_large':status===400?'invalid_input':status===415?'invalid_input':'outcome_unknown';
  if(status===401||code==='insufficient_scope')reply.header('WWW-Authenticate',`Bearer resource_metadata="${config.origin}/.well-known/oauth-protected-resource/mcp", scope="state:read${code==='insufficient_scope'?' state:write':''}"${code==='insufficient_scope'?', error="insufficient_scope"':''}`);
  reply.code(status).send({error:code,message:known?error.message:'Request failed. Retain the exact request if a write may have started.'});
 });
 async function run(req:object,principal:Principal,name:string,args:unknown){
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([invoke(principal,name,args,controller.signal,(phase,ms)=>{const value=stats.get(req);if(value)value[phase]+=ms;}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new ActionError('outcome_unknown','The request deadline elapsed; retain the exact request.',503));},20_000);})]);}finally{clearTimeout(timer);}
 }
 const identity=(req:{headers:Record<string,string|string[]|undefined>},write:boolean)=>authentication.authenticate({authorization:req.headers.authorization as string|undefined,cookie:req.headers.cookie as string|undefined,csrf:req.headers['x-csrf-token'] as string|undefined},write);
 const metadata={resource:config.resource,authorization_servers:[config.issuer],scopes_supported:['state:read','state:write'],bearer_methods_supported:['header']};
 for(const route of ['/.well-known/oauth-protected-resource/mcp','/.well-known/oauth-protected-resource'])app.get(route,async()=>metadata);
 app.get('/health/live',async()=>({status:'ok'}));app.get('/health/ready',async()=>({status:'ready'}));
 app.get('/',async(_req,reply)=>reply.type('text/html').send(webHtml));
 app.get('/assets/:name',async(req,reply)=>{
  const asset=assets.get((req.params as {name:string}).name);if(asset===undefined)return reply.code(404).send({error:'not_found'});
  return reply.type('text/javascript').header('Cache-Control','public,max-age=31536000,immutable').send(asset);
 });
 app.get('/ui/widget',async(req,reply)=>{const p=await identity(req,false);authorize(p,'list_actions',config.writeMode);return reply.type('text/html').send(widgetHtml);});
 app.get('/api/session',async(req)=>{const p=await identity(req,false);authorize(p,'list_actions',config.writeMode);return authentication.sessionInfo(p,req.headers.cookie);});
 app.get('/auth/login',async(req,reply)=>{
  const query=req.query as {return_to?:string;channel?:string};const result=await authentication.beginLogin(query.return_to??'/',query.channel??'');return reply.header('Set-Cookie',result.cookie).redirect(result.url);
 });
 app.get('/auth/callback',async(req,reply)=>{
  const result=await authentication.finishLogin(new URL(req.url,config.origin),req.headers.cookie);
  const channel=JSON.stringify(result.channel).replaceAll('<','\\u003c');
  return reply.header('Set-Cookie',result.cookies).type('text/html').send(`<!doctype html><meta charset="utf-8"><title>Connected</title><p>Connected. Return to the original window.</p><script>new BroadcastChannel(${channel}).postMessage({done:true});window.close();</script>`);
 });
 app.post('/auth/logout',async(req,reply)=>{await identity(req,true);return reply.header('Set-Cookie',await authentication.logout(req.headers.cookie)).send({status:'signed_out'});});
 app.post('/api/actions',async(req)=>{
  const principal=await identity(req,true),body=req.body as {name?:unknown;arguments?:unknown};
  if(!body||typeof body.name!=='string'||Object.keys(body).some(key=>!['name','arguments'].includes(key)))fail('invalid_input','Expected name and arguments.');
  authorize(principal,body.name,config.writeMode);return run(req,principal,body.name,body.arguments??{});
 });
 app.post('/mcp',async(req,reply)=>{
  if(req.headers.cookie)fail('unauthenticated','MCP requires bearer authentication.',401);
  const principal=await identity(req,false);authorize(principal,'list_actions',config.writeMode);
  const version=req.headers['mcp-protocol-version'];if(version&&!['2025-03-26','2025-06-18','2025-11-25'].includes(String(version)))fail('invalid_input','Unsupported MCP protocol version.');
  const body=req.body as {method?:string;params?:{name?:string}};if(body?.method==='tools/call'&&typeof body.params?.name==='string')authorize(principal,body.params.name,config.writeMode);
  const result=await dispatchMcp(req.body,async(name,args)=>{authorize(principal,name,config.writeMode);return run(req,principal,name,args);},principal.scopes.includes('state:write'));
  return result.body===null?reply.code(result.status).send():reply.code(result.status).send(result.body);
 });
 app.route({method:['GET','DELETE'],url:'/mcp',handler:async(_req,reply)=>reply.header('Allow','POST').code(405).send()});
 return app;
}
