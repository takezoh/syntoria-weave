import {ASSIGNED_RESOURCE_URI,RESOURCE_URIS,STATE_RESOURCE_URI,assignedResource,stateResource} from './state-resource';
import {ActionError} from '../domain/core';
import {privateDefinitions,privateResources} from './tool-definitions';
import {UI_URI} from '../widget';
import {createActionUiResource} from './ui-resource';
import {assistanceInstructions} from '../assistance';
import {INVALID_PARAMS,INVALID_REQUEST,METHOD_NOT_FOUND,SERVER_INFO,SERVER_INFO_KEY,SUPPORTED_VERSIONS,errorCause,negotiate,rpcError,type McpHeaders,type RequestId} from './protocol';
export type Invoke=(name:string,args:unknown)=>Promise<unknown>;
/** A subscriptions/listen request the transport serves as a long-lived response stream. */
export type McpListen={id:RequestId;resources:readonly string[]};
export type McpDispatch={status:number;body:unknown;listen?:McpListen;cause?:string};
type Subscriptions={set(resource:string,subscribed:boolean):Promise<void>};

// Every result is fresh user-scoped state or deployment-versioned definitions behind authorization.
const cacheable={ttlMs:0,cacheScope:'private'};
const capabilities=(subscriptions?:Subscriptions)=>({tools:{},resources:subscriptions?{subscribe:true}:{}});
const listTools=(canWrite:boolean)=>privateDefinitions.filter(tool=>tool.name!=='open_verification'&&(canWrite||tool.annotations.readOnlyHint));
const listResources=()=>[...privateResources.filter(resource=>resource.uri===UI_URI),stateResource,assignedResource];

async function readResource(uri:unknown,invoke:Invoke){
 if(uri===STATE_RESOURCE_URI)return [{uri:STATE_RESOURCE_URI,mimeType:'application/json',text:JSON.stringify(await invoke('list_actions',{}))}];
 if(uri===ASSIGNED_RESOURCE_URI)return [{uri:ASSIGNED_RESOURCE_URI,mimeType:'application/json',text:JSON.stringify(await invoke('list_assigned_collaborations',{}))}];
 if(uri===UI_URI)return [createActionUiResource()];
 return null;
}

async function callTool(invoke:Invoke,name:string,args:unknown){
 try{const data=await invoke(name,args);return {result:{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data}};}
 catch(error){const code=error instanceof ActionError?error.code:'outcome_unknown';return {result:{isError:true,structuredContent:{error:{code,message:code==='outcome_unknown'?'Retain the exact request and check its result.':error instanceof Error?error.message:code}},content:[{type:'text',text:code}]},cause:error instanceof ActionError?undefined:errorCause(error)};}
}

/** Stateless protocol adapter; authentication and scope gates precede this entry. */
export async function dispatchMcp(raw:unknown,invoke:Invoke,canWrite:boolean,{headers={},subscriptions}:{headers?:McpHeaders;subscriptions?:Subscriptions}={}):Promise<McpDispatch>{
 const body=raw as {jsonrpc?:unknown;id?:unknown;method?:unknown;params?:Record<string,unknown>};
 if(!body||body.jsonrpc!=='2.0'||typeof body.method!=='string'||(body.id!==undefined&&body.id!==null&&typeof body.id!=='string'&&typeof body.id!=='number'))return rpcError(null,400,INVALID_REQUEST,'Invalid request');
 const id=(body.id??null) as RequestId|null,p=body.params??{},method=body.method;
 const era=negotiate({id,method,params:body.params},headers);
 if('status' in era)return era;
 if(method.startsWith('notifications/'))return {status:202,body:null};
 return era.era==='modern'?modern():legacy();

 async function legacy():Promise<McpDispatch>{
  const reply=(result:unknown)=>({status:200,body:{jsonrpc:'2.0',id,result}});
  switch(method){
   case 'initialize':return reply({protocolVersion:['2025-03-26','2025-06-18','2025-11-25'].includes(String(p.protocolVersion))?p.protocolVersion:'2025-11-25',capabilities:capabilities(subscriptions),serverInfo:SERVER_INFO,instructions:assistanceInstructions});
   case 'ping':return reply({});
   case 'tools/list':return reply({tools:listTools(canWrite)});
   case 'resources/list':return reply({resources:listResources()});
   case 'resources/templates/list':return reply({resourceTemplates:[]});
   case 'resources/subscribe':case 'resources/unsubscribe':if(subscriptions&&typeof p.uri==='string'&&RESOURCE_URIS.includes(p.uri)){await subscriptions.set(p.uri,method==='resources/subscribe');return reply({});}break;
   case 'resources/read':{const contents=await readResource(p.uri,invoke);if(contents)return reply({contents});break;}
   case 'tools/call':{
    if(typeof p.name!=='string')return rpcError(id,400,INVALID_PARAMS,'Tool name required');
    const outcome=await callTool(invoke,p.name,p.arguments??{});return {...reply(outcome.result),cause:outcome.cause};
   }
  }
  return rpcError(id,200,METHOD_NOT_FOUND,'Method not found');
 }

 async function modern():Promise<McpDispatch>{
  if(id===null)return rpcError(null,400,INVALID_REQUEST,'Invalid request');
  const complete=(result:Record<string,unknown>)=>({status:200,body:{jsonrpc:'2.0',id,result:{...result,resultType:'complete',_meta:{[SERVER_INFO_KEY]:SERVER_INFO}}}});
  switch(method){
   case 'server/discover':return complete({supportedVersions:SUPPORTED_VERSIONS,capabilities:capabilities(subscriptions),instructions:assistanceInstructions,...cacheable});
   case 'tools/list':return complete({tools:listTools(canWrite),...cacheable});
   case 'resources/list':return complete({resources:listResources(),...cacheable});
   case 'resources/templates/list':return complete({resourceTemplates:[],...cacheable});
   case 'resources/read':{const contents=await readResource(p.uri,invoke);return contents?complete({contents,...cacheable}):rpcError(id,200,INVALID_PARAMS,'Resource not found',{uri:p.uri});}
   case 'tools/call':{
    if(typeof p.name!=='string')return rpcError(id,400,INVALID_PARAMS,'Tool name required');
    const outcome=await callTool(invoke,p.name,p.arguments??{});return {...complete(outcome.result),cause:outcome.cause};
   }
   case 'subscriptions/listen':{
    if(!subscriptions)break;
    const filter=p.notifications;
    if(!filter||typeof filter!=='object'||Array.isArray(filter))return rpcError(id,400,INVALID_PARAMS,'A notifications filter is required.');
    const requested=(filter as {resourceSubscriptions?:unknown}).resourceSubscriptions;
    // Unsupported notification types and unknown resources are omitted from the acknowledged filter.
    return {status:200,body:null,listen:{id,resources:Array.isArray(requested)?RESOURCE_URIS.filter(uri=>requested.includes(uri)):[]}};
   }
  }
  return rpcError(id,404,METHOD_NOT_FOUND,'Method not found');
 }
}
