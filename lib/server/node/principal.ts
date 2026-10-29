import {fail} from '../../domain/core';
import {validClientName} from '../../data/model/client-name';
export type Scopes = readonly string[];
/** Who performed a request: the person in the Weave app (browser session) or a client connection acting for them. */
export type ActorKind = 'user' | 'client';
/** `clientName` is the client's unverified registration name relayed by Gate, for display only. */
export type Principal = Readonly<{user:string;issuer:string;subject:string;connectionId:string;clientId:string;actorKind:ActorKind;clientName:string|null;scopes:Scopes}>;
const issued=new WeakSet<object>();
/** Only authentication composition can mint a request capability. */
export function issuePrincipal(value:Omit<Principal,'clientName'>&{clientName?:string|null}):Principal {
 if(!value.user||!value.subject||!value.connectionId||!value.clientId||(value.actorKind!=='user'&&value.actorKind!=='client'))fail('unauthenticated','Verified identity is required.',401);
 const clientName=validClientName(value.clientName)?value.clientName:null;
 const principal=Object.freeze({...value,clientName,scopes:Object.freeze([...value.scopes])});issued.add(principal);return principal;
}
export function verifyPrincipal(value:Principal):Principal {
 if(!issued.has(value))fail('unauthenticated','Verified identity is required.',401);return value;
}
export const mutators=new Set(['add_action','rename_action','capture_intent','apply_change','undo_change','propose_collaboration','update_collaboration']);
/** How a client connection's writes are approved: `auto` approves each one at once, `blocked` refuses them. The person's own writes need no approval. */
export type ClientWriteApproval='auto'|'blocked';
export type WritePolicy=Readonly<{writeMode:'blocked'|'enabled';clientWriteApproval:ClientWriteApproval}>;
export function authorize(value:Principal,name:string,policy:WritePolicy) {
 const p=verifyPrincipal(value);
 if(!p.scopes.includes('state:read')||(mutators.has(name)&&!p.scopes.includes('state:write')))fail('insufficient_scope','Required access is not granted.',403);
 if(mutators.has(name)&&policy.writeMode!=='enabled')fail('unavailable','Writes are temporarily blocked. Retain the exact request.',503);
 if(mutators.has(name)&&p.actorKind==='client'&&policy.clientWriteApproval!=='auto')fail('client_write_denied','This service does not approve changes from AI or other client connections. Make the change in the Weave app.',403);
}
