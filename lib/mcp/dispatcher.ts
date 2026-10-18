import {ActionError} from '../domain/core';
import {privateDefinitions,privateResources} from './tool-definitions';
import {UI_URI} from '../widget';
import {createActionUiResource} from './ui-resource';
import {assistanceInstructions} from '../assistance';
export type Invoke=(name:string,args:unknown)=>Promise<unknown>;
/** Stateless protocol adapter; authentication and scope gates precede this entry. */
export async function dispatchMcp(raw:unknown,invoke:Invoke,canWrite:boolean){
 const body=raw as {jsonrpc?:unknown;id?:unknown;method?:unknown;params?:Record<string,unknown>};
 if(!body||body.jsonrpc!=='2.0'||typeof body.method!=='string'||(body.id!==undefined&&body.id!==null&&typeof body.id!=='string'&&typeof body.id!=='number'))return {status:400,body:{jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}}};
 const id=body.id??null,p=body.params??{};
 const reply=(result:unknown)=>({status:200,body:{jsonrpc:'2.0',id,result}});
 if(body.method.startsWith('notifications/'))return {status:202,body:null};
 switch(body.method){
  case 'initialize':return reply({protocolVersion:['2025-03-26','2025-06-18','2025-11-25'].includes(String(p.protocolVersion))?p.protocolVersion:'2025-11-25',capabilities:{tools:{},resources:{}},serverInfo:{name:'action-tools',version:'0.3.0'},instructions:assistanceInstructions});
  case 'ping':return reply({});
  case 'tools/list':return reply({tools:privateDefinitions.filter(tool=>tool.name!=='open_verification'&&(canWrite||tool.annotations.readOnlyHint))});
  case 'resources/list':return reply({resources:privateResources.filter(resource=>resource.uri===UI_URI)});
  case 'resources/templates/list':return reply({resourceTemplates:[]});
  case 'resources/read':if(p.uri===UI_URI)return reply({contents:[createActionUiResource()]});break;
  case 'tools/call':{
   if(typeof p.name!=='string')return {status:400,body:{jsonrpc:'2.0',id,error:{code:-32602,message:'Tool name required'}}};
   try{const data=await invoke(p.name,p.arguments??{});return reply({content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data});}
   catch(error){const code=error instanceof ActionError?error.code:'outcome_unknown';return reply({isError:true,structuredContent:{error:{code,message:code==='outcome_unknown'?'Retain the exact request and check its result.':error instanceof Error?error.message:code}},content:[{type:'text',text:code}]});}
  }
 }
 return {status:200,body:{jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}}};
}
