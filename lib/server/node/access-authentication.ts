import {timingSafeEqual} from 'node:crypto';
import {fail} from '../../domain/core';
import type {IdentityStore} from '../../adapters/postgres/identity-store';
import {hash,type AuthenticateHeaders,type Authentication} from './authentication';
import {issuePrincipal,verifyPrincipal,type Principal} from './principal';
import {createAccessVerifier,AccessVerificationError} from './access-verifier';
import type {ServiceConfig} from './config';
import type {JWTVerifyGetKey} from 'jose';

/** One admitted owner, with separate browser and shared AI audiences and capabilities. */
export function createAccessAuthentication(config:ServiceConfig,store:IdentityStore,keys?:JWTVerifyGetKey):Authentication {
 const access=config.access;if(!access)throw new Error('Access configuration required.');
 const browser=createAccessVerifier({...access,audience:access.browserAudience},keys);
 const mcp=createAccessVerifier({...access,audience:access.mcpAudience},keys);
 const credentials=new WeakMap<Principal,{assertion:string;actor:'browser'|'mcp';csrf:string}>();
 async function verify(assertion:string|undefined,actor:'browser'|'mcp'){
  try{await(actor==='browser'?browser:mcp).authenticate(assertion);}
  catch(error){if(error instanceof AccessVerificationError)fail(error.status===503?'unavailable':error.status===403?'forbidden':'unauthenticated',error.message,error.status);throw error;}
 }
 const equal=(left:string,right:string)=>{const a=Buffer.from(left),b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b);};
 return {
  async authenticate(headers:AuthenticateHeaders,write=false){
   const actor=headers.actor??'mcp';await verify(headers.assertion,actor);
   const assertion=headers.assertion!;
   const csrf=hash('access-browser-csrf\0'+assertion);
   if(actor==='browser'&&write&&(!headers.origin||!config.spaOrigins.includes(headers.origin)||!equal(headers.csrf??'',csrf)))fail('forbidden','Browser writes require Origin and CSRF validation.',403);
   const binding={issuer:access.ownerIssuer,subject:access.ownerSubject};
   const identity=await store.resolveSubject(binding);
   const group=actor==='browser'?'shared-user':'shared-ai';
   const principal=issuePrincipal({...binding,user:identity.user,clientId:group,connectionId:group,actorKind:actor==='browser'?'user':'client',clientName:null,scopes:['state:read','state:write']});
   credentials.set(principal,{assertion,actor,csrf});return principal;
  },
  async revalidate(principal,client){
   verifyPrincipal(principal);const credential=credentials.get(principal);
   if(!credential)fail('unauthenticated','Verified Access capability required.',401);
   await verify(credential.assertion,credential.actor);
   const current=await store.resolveSubject({issuer:access.ownerIssuer,subject:access.ownerSubject},client);
   if(current.user!==principal.user)fail('forbidden','Owner admission changed.',403);
  },
  sessionInfo(principal){
   verifyPrincipal(principal);const credential=credentials.get(principal);
   if(credential?.actor!=='browser')fail('unauthenticated','Browser session required.',401);
   return {account_scope:hash('account\0'+principal.user),csrf_token:credential.csrf};
  },
 };
}
