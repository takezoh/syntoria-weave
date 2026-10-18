import {fail} from '../../domain/core';
export type Scopes = readonly string[];
export type Principal = Readonly<{user:string;issuer:string;subject:string;clientId:string;scopes:Scopes}>;
const issued=new WeakSet<object>();
/** Only authentication composition can mint a request capability. */
export function issuePrincipal(value:Principal):Principal {
 if(!value.user||!value.subject||!value.clientId)fail('unauthenticated','Verified identity is required.',401);
 const principal=Object.freeze({...value,scopes:Object.freeze([...value.scopes])});issued.add(principal);return principal;
}
export function verifyPrincipal(value:Principal):Principal {
 if(!issued.has(value))fail('unauthenticated','Verified identity is required.',401);return value;
}
export const mutators=new Set(['add_action','rename_action','capture_intent','apply_change','undo_change']);
export function authorize(value:Principal,name:string,writeMode:'blocked'|'enabled') {
 const p=verifyPrincipal(value);
 if(!p.scopes.includes('state:read')||(mutators.has(name)&&!p.scopes.includes('state:write')))fail('insufficient_scope','Required access is not granted.',403);
 if(mutators.has(name)&&writeMode!=='enabled')fail('unavailable','Writes are temporarily blocked. Retain the exact request.',503);
}
