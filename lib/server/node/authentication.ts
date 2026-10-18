import {createHash,timingSafeEqual} from 'node:crypto';
import {fail} from '../../domain/core';
import {issuePrincipal,verifyPrincipal,type Principal} from './principal';
import type {ServiceConfig} from './config';
import {createGateVerifier,GateError,type GateDependencies,type GatePrincipal,type GateSessionPrincipal} from './gate-verifier';
import type {IdentityBinding,IdentityStore} from '../../adapters/postgres/identity-store';

export const sessionCookie='__Secure-gate_session';
const sessionFormat=/^[A-Za-z0-9_-]{43}$/;
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');

export type GateVerification=Readonly<{
 verifyToken(token:string):Promise<GatePrincipal>;
 verifySession(session:string):Promise<GateSessionPrincipal>;
}>;

function validSessionSecret(value:string){
 if(value.length!==43||!sessionFormat.test(value))return false;
 const bytes=Buffer.from(value,'base64url');
 return bytes.length===32&&bytes.toString('base64url')===value;
}

export function cookieValue(cookie:string|readonly string[]|undefined,name:string){
 const header=typeof cookie==='string'?cookie:(cookie??[]).join(';');
 const found=header.split(';').map(value=>value.trim()).filter(value=>value.slice(0,value.indexOf('=')<0?value.length:value.indexOf('='))===name);
 if(found.length>1)fail('unauthenticated','Ambiguous session.',401);
 if(!found.length)return null;
 const equal=found[0]!.indexOf('=');
 return equal<0?'':found[0]!.slice(equal+1);
}

function constantTimeEqual(a:string,b:string){
 const left=Buffer.from(a),right=Buffer.from(b);
 return left.length===right.length&&timingSafeEqual(left,right);
}

function verifiedCall<T>(call:()=>Promise<T>){
 return call().catch(error=>{
  if(error instanceof GateError)fail(error.status===401?'unauthenticated':'unavailable',error.message,error.status);
  throw error;
 });
}

/** Create uncached online Gate verification calls for bearer tokens and browser sessions. */
export function createGateVerification(config:ServiceConfig,dependencies:GateDependencies={}){
 const verifier=createGateVerifier({issuer:config.issuer,audience:config.resource,clientId:config.gateClientId,clientSecret:config.gateClientSecret,allowedClientIds:config.allowedClientIds},dependencies);
 return Object.freeze({
  verifyToken:(token:string)=>verifiedCall(()=>verifier.verifyToken(token)),
  verifySession:(session:string)=>verifiedCall(()=>verifier.verifySession(session)),
 });
}

export type AuthenticateHeaders=Readonly<{authorization?:string|readonly string[];cookie?:string|readonly string[];csrf?:string;origin?:string}>;
type Credential=Readonly<{kind:'bearer'|'session';value:string;csrfToken?:string}>;

function principalMatches(principal:Principal,verified:GatePrincipal){
 return verified.issuer===principal.issuer&&verified.userId===principal.subject&&verified.clientId===principal.clientId&&verified.connectionId===principal.connectionId;
}

export function createAuthentication(config:ServiceConfig,store:IdentityStore,verification:GateVerification=createGateVerification(config)) {
 const credentials=new WeakMap<Principal,Credential>();

 async function bind(binding:IdentityBinding,connectionId:string,credential:Credential,csrf?:string,client?:Parameters<IdentityStore['grant']>[1]){
  const grant=await store.grant(binding,client);
  const principal=issuePrincipal({...binding,connectionId,user:grant.user,scopes:['state:read','state:write']});
  credentials.set(principal,{...credential,csrfToken:csrf});
  return principal;
 }

 return {
  async authenticate(headers:AuthenticateHeaders,write=false):Promise<Principal>{
   if(Array.isArray(headers.authorization)&&headers.authorization.length!==1)fail('unauthenticated','Ambiguous Authorization header.',401);
   const authorization=Array.isArray(headers.authorization)?headers.authorization[0]:headers.authorization;
   const token=cookieValue(headers.cookie,sessionCookie);
   if(authorization!==undefined&&token!==null)fail('unauthenticated','Do not mix bearer and cookie identities.',401);

   if(authorization!==undefined){
    const match=authorization.match(/^Bearer ([A-Za-z0-9._~+/-]+=*)$/);
    if(!match)fail('unauthenticated','A bearer token is required.',401);
    const verified=await verification.verifyToken(match[1]!);
    const binding={issuer:verified.issuer,subject:verified.userId,clientId:verified.clientId};
    return bind(binding,verified.connectionId,{kind:'bearer',value:match[1]!});
   }

   if(token===null)fail('unauthenticated','Authentication is required.',401);
   if(!validSessionSecret(token))fail('unauthenticated','Browser session is invalid.',401);
   if(write&&(!headers.origin||!config.spaOrigins.includes(headers.origin)||!headers.csrf))fail('forbidden','Browser writes require an allowed Origin and CSRF validation.',403);
   const verified=await verification.verifySession(token);
   if(verified.sessionType!=='browser'||verified.clientId!==config.browserClientId||!Number.isSafeInteger(verified.expiresAt)||verified.expiresAt<=Date.now()/1000||!verified.csrfToken)fail('unauthenticated','Browser session is invalid.',401);
   if(write&&!constantTimeEqual(headers.csrf??'',verified.csrfToken))fail('forbidden','CSRF validation failed.',403);
   return bind({issuer:verified.issuer,subject:verified.userId,clientId:verified.clientId},verified.connectionId,{kind:'session',value:token},verified.csrfToken);
  },

  async revalidate(principal:Principal,client:Parameters<IdentityStore['grant']>[1]){
   const verifiedPrincipal=verifyPrincipal(principal),credential=credentials.get(principal);
   if(!credential||!verifiedPrincipal.connectionId)fail('unauthenticated','Verified connection is required.',401);
   if(credential.kind==='session'){
    const verified=await verification.verifySession(credential.value);
    if(verified.sessionType!=='browser'||verified.clientId!==config.browserClientId||!principalMatches(verifiedPrincipal,verified)||verified.expiresAt<=Date.now()/1000)fail('unauthenticated','Browser connection changed.',401);
   }else{
    const verified=await verification.verifyToken(credential.value);
    if(!principalMatches(verifiedPrincipal,verified))fail('unauthenticated','Connection identity changed.',401);
   }
   const grant=await store.grant({issuer:verifiedPrincipal.issuer,subject:verifiedPrincipal.subject,clientId:verifiedPrincipal.clientId},client);
   if(grant.user!==verifiedPrincipal.user)fail('forbidden','Access has been revoked.',403);
  },

  sessionInfo(principal:Principal){
   const value=credentials.get(principal),verifiedPrincipal=verifyPrincipal(principal);
   if(!value||value.kind!=='session'||!value.csrfToken)fail('unauthenticated','Browser session required.',401);
   return {account_scope:hash('account\0'+verifiedPrincipal.user),csrf_token:value.csrfToken};
  },
 };
}

export type Authentication=ReturnType<typeof createAuthentication>;
