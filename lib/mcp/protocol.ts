import {ActionError} from '../domain/core';

/** Initialize-based revisions; the server keeps their session-free behavior for existing clients. */
export const LEGACY_VERSIONS:readonly string[]=['2025-03-26','2025-06-18','2025-11-25'];
/** Stateless revisions: every request carries its version, capabilities and transport headers. */
export const MODERN_VERSIONS:readonly string[]=['2026-07-28'];
export const SUPPORTED_VERSIONS:readonly string[]=[...MODERN_VERSIONS,...LEGACY_VERSIONS];
export const SERVER_INFO=Object.freeze({name:'action-tools',version:'0.3.0'});
export const PROTOCOL_VERSION_KEY='io.modelcontextprotocol/protocolVersion';
export const CLIENT_INFO_KEY='io.modelcontextprotocol/clientInfo';
export const CLIENT_CAPABILITIES_KEY='io.modelcontextprotocol/clientCapabilities';
export const SERVER_INFO_KEY='io.modelcontextprotocol/serverInfo';
export const SUBSCRIPTION_ID_KEY='io.modelcontextprotocol/subscriptionId';
export const INVALID_REQUEST=-32600,METHOD_NOT_FOUND=-32601,INVALID_PARAMS=-32602,HEADER_MISMATCH=-32020,UNSUPPORTED_PROTOCOL_VERSION=-32022;

export type RequestId=string|number;
/** Transport header values; null marks a repeated header. */
export type McpHeaders=Readonly<{protocolVersion?:string|null;method?:string|null;name?:string|null}>;
export type McpReply={status:number;body:unknown};
export type McpEra={era:'legacy'}|{era:'modern';version:string};
export type McpObservation=Readonly<Record<string,string|number|readonly string[]>>;
type Message={id?:unknown;method:string;params?:unknown};

const NAMED_METHODS=new Set(['tools/call','resources/read','prompts/get']);
const record=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;

export function rpcError(id:RequestId|null,status:number,code:number,message:string,data?:unknown):McpReply{
 return {status,body:{jsonrpc:'2.0',id,error:data===undefined?{code,message}:{code,message,data}}};
}
export function unsupportedVersion(id:RequestId|null,requested:string){
 return rpcError(id,400,UNSUPPORTED_PROTOCOL_VERSION,'Unsupported protocol version',{supported:SUPPORTED_VERSIONS,requested});
}

function headerValue(value:string){
 const encoded=/^=\?base64\?([A-Za-z0-9+/]*={0,2})\?=$/.exec(value)?.[1];
 if(encoded===undefined)return value;
 try{return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(encoded),char=>char.charCodeAt(0)));}catch{return null;}
}

/** Selects the protocol era of one request and applies the modern header and metadata validation. */
export function negotiate(message:Message,headers:McpHeaders):McpEra|McpReply{
 const id=(message.id??null) as RequestId|null,params=record(message.params),meta=record(params?._meta),declared=meta?.[PROTOCOL_VERSION_KEY],header=headers.protocolVersion;
 if(header===null)return rpcError(id,400,HEADER_MISMATCH,'Ambiguous MCP-Protocol-Version header.');
 if(header!==undefined&&!SUPPORTED_VERSIONS.includes(header))return unsupportedVersion(id,header);
 // The modern revision defines no header requirements for notification POSTs.
 if(message.method.startsWith('notifications/'))return header!==undefined&&MODERN_VERSIONS.includes(header)?{era:'modern',version:header}:{era:'legacy'};
 if(declared===undefined&&!MODERN_VERSIONS.includes(header??''))return {era:'legacy'};
 if(declared!==header)return rpcError(id,400,HEADER_MISMATCH,'MCP-Protocol-Version header does not match the request protocol version.');
 if(header===undefined||!MODERN_VERSIONS.includes(header))return {era:'legacy'};
 if(headers.method!==message.method)return rpcError(id,400,HEADER_MISMATCH,'Mcp-Method header does not match the request method.');
 const target=message.method==='resources/read'?params?.uri:params?.name;
 if(NAMED_METHODS.has(message.method)&&typeof target==='string'&&(typeof headers.name!=='string'||headerValue(headers.name)!==target))return rpcError(id,400,HEADER_MISMATCH,'Mcp-Name header does not match the request target.');
 if(!record(meta?.[CLIENT_CAPABILITIES_KEY]))return rpcError(id,400,INVALID_PARAMS,'Request _meta must declare clientCapabilities.');
 return {era:'modern',version:header};
}

// Logged protocol fields are bounded vocabularies; caller values outside them are reported as invalid.
const VERSION=/^\d{4}-\d{2}-\d{2}$/,METHOD=/^[a-z][A-Za-z0-9_]{0,31}(?:\/[a-z][A-Za-z0-9_]{0,31}){0,2}$/,TOOL=/^[a-z][a-z0-9_]{0,63}$/,LABEL=/^[A-Za-z0-9][\w .()+/-]{0,63}$/,EXTENSION=/^[a-z][a-z0-9.-]{0,40}\/[A-Za-z0-9][\w.-]{0,40}$/,CODE=/^[a-z][a-z_]{0,63}$/;
const bounded=(value:unknown,pattern:RegExp)=>value===undefined?undefined:value===null?'ambiguous':typeof value==='string'&&pattern.test(value)?value:'invalid';
const compact=(values:Record<string,string|number|readonly string[]|undefined>)=>Object.fromEntries(Object.entries(values).filter(([,value])=>value!==undefined)) as McpObservation;

/** Protocol identity of a request for operational logs: never arguments, content, tokens or user data. */
export function observeRequest(raw:unknown,headers:McpHeaders):McpObservation{
 const message=record(raw),params=record(message?.params),meta=record(params?._meta),initialize=message?.method==='initialize';
 const client=record(meta?.[CLIENT_INFO_KEY]??(initialize?params?.clientInfo:undefined));
 const extensions=record(record(meta?.[CLIENT_CAPABILITIES_KEY]??(initialize?params?.capabilities:undefined))?.extensions);
 return compact({
  mcp_version:bounded(headers.protocolVersion!==undefined?headers.protocolVersion:initialize?params?.protocolVersion:undefined,VERSION),
  mcp_method:bounded(message?.method,METHOD),
  mcp_tool:message?.method==='tools/call'?bounded(params?.name,TOOL):undefined,
  mcp_client:client?[bounded(client.name,LABEL)??'unknown',bounded(client.version,LABEL)??'unknown'].join(' '):undefined,
  mcp_extensions:extensions?Object.keys(extensions).slice(0,8).map(key=>EXTENSION.test(key)?key:'invalid'):undefined,
 });
}

/** The JSON-RPC or tool error code of a reply, if any. */
export function observeReply(reply:McpReply):McpObservation{
 const body=record(reply.body),error=record(body?.error),result=record(body?.result);
 if(typeof error?.code==='number')return {mcp_error:error.code};
 const toolError=result?.isError===true?record(record(result.structuredContent)?.error):undefined;
 return compact({mcp_error:toolError?bounded(toolError.code,CODE):undefined});
}

/** A loggable failure class: domain code, error name and system/SQLSTATE code, never its message. */
export function errorCause(error:unknown){
 if(error instanceof ActionError)return error.code;
 if(!(error instanceof Error))return typeof error;
 const name=/^\w{1,40}$/.test(error.name)?error.name:'Error',code=(error as {code?:unknown}).code;
 return typeof code==='string'&&/^[A-Z0-9_]{2,32}$/.test(code)?name+' '+code:name;
}
