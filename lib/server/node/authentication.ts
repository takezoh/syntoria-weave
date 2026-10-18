import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey,type JWTPayload} from 'jose';
import * as oidc from 'openid-client';
import {createHash,createHmac,randomBytes,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
import {fail} from '../../domain/core';
import {issuePrincipal,verifyPrincipal,type Principal} from './principal';
import type {ServiceConfig} from './config';
import type {IdentityStore} from '../../adapters/postgres/identity-store';

export const sessionCookie='__Host-action_session',loginCookie='__Host-action_login';
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const random=()=>randomBytes(32).toString('base64url');
export function cookieValue(cookie:string|undefined,name:string){
 const found=(cookie??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));
 if(found.length>1)fail('unauthenticated','Ambiguous session.',401);
 return found[0]?.slice(name.length+1)??null;
}
export function setCookie(name:string,value:string,maxAge:number){return `${name}=${value}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`;}
export function csrfToken(key:Buffer,token:string){return createHmac('sha256',key).update(token).digest('base64url');}
function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function encrypt(key:Buffer,text:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url');}
function decrypt(key:Buffer,text:string){const data=Buffer.from(text,'base64url'),decipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));decipher.setAuthTag(data.subarray(12,28));return Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8');}
export function createTokenVerifier(config:Pick<ServiceConfig,'issuer'|'resource'>,keys?:JWTVerifyGetKey){
 const keySet=keys??createRemoteJWKSet(new URL('.well-known/jwks.json',config.issuer),{cooldownDuration:30_000,timeoutDuration:3000,cacheMaxAge:600_000});
 return async(token:string)=>{
  try{
   const {payload}=await jwtVerify(token,keySet,{issuer:config.issuer,audience:config.resource,algorithms:['RS256'],clockTolerance:60,requiredClaims:['exp','iat','sub']});
   if(!payload.sub||typeof payload.scope!=='string'||typeof (payload.azp??payload.client_id)!=='string'||(payload.azp&&payload.client_id&&payload.azp!==payload.client_id))throw new Error('Invalid token identity.');
   return payload;
  }catch{fail('unauthenticated','A valid API access token is required.',401);}
 };
}
export type AuthenticateHeaders=Readonly<{authorization?:string;cookie?:string;csrf?:string}>;
export function createAuthentication(config:ServiceConfig,store:IdentityStore,verifyToken:(token:string)=>Promise<JWTPayload>=createTokenVerifier(config)) {
 let oidcConfig:Promise<oidc.Configuration>|undefined;
 const provider=()=>oidcConfig??(oidcConfig=oidc.discovery(new URL(config.issuer),config.webClientId,config.webClientSecret).catch(error=>{oidcConfig=undefined;throw error;}));
 return {
  async authenticate(headers:AuthenticateHeaders,write=false):Promise<Principal>{
   const token=cookieValue(headers.cookie,sessionCookie);
   if(headers.authorization&&token)fail('unauthenticated','Do not mix bearer and cookie identities.',401);
   let binding,scopes:string[]|undefined;
   if(headers.authorization){
    const match=headers.authorization.match(/^Bearer ([A-Za-z0-9._~-]+)$/);if(!match)fail('unauthenticated','A bearer token is required.',401);
    const payload=await verifyToken(match[1]);binding={issuer:config.issuer,subject:payload.sub!,clientId:String(payload.azp??payload.client_id)};scopes=String(payload.scope).split(' ');
   }else if(token){
    binding=await store.session(hash(token));if(!binding)fail('unauthenticated','Sign in again; your proposal is retained.',401);
    if(write&&!equal(headers.csrf??'',csrfToken(config.csrfKey,token)))fail('forbidden','CSRF validation failed.',403);
   }else fail('unauthenticated','Authentication is required.',401);
   const grant=await store.grant(binding);
   return issuePrincipal({...binding,user:grant.user,scopes:scopes?scopes.filter(scope=>grant.scopes.includes(scope)):grant.scopes});
  },
  async revalidate(principal:Principal,client:Parameters<IdentityStore['grant']>[1]){
   const p=verifyPrincipal(principal),grant=await store.grant(p,client);
   if(grant.user!==p.user||!['state:read','state:write'].every(scope=>p.scopes.includes(scope)&&grant.scopes.includes(scope)))fail('forbidden','Write access has been revoked.',403);
  },
  async beginLogin(returnTo:string,channel:string){
   if(!returnTo.startsWith('/')||returnTo.startsWith('//')||returnTo.includes('\\')||returnTo.startsWith('/auth/'))returnTo='/';
   if(!/^[A-Za-z0-9_-]{20,100}$/.test(channel))channel=random();
   const state=random(),binding=random(),nonce=random(),verifier=oidc.randomPKCECodeVerifier();
   await store.saveLogin({state_hash:hash(state),binding_hash:hash(binding),verifier:encrypt(config.loginKey,verifier),nonce,return_to:returnTo,channel});
   const url=oidc.buildAuthorizationUrl(await provider(),{redirect_uri:config.origin+'/auth/callback',scope:'openid profile',state,nonce,code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256'});
   return {url:url.href,cookie:setCookie(loginCookie,binding,600)};
  },
  async finishLogin(url:URL,cookies:string|undefined){
   const state=url.searchParams.get('state'),binding=cookieValue(cookies,loginCookie);if(!state||!binding)fail('unauthenticated','Login state is missing.',401);
   const attempt=await store.consumeLogin(hash(state),hash(binding));if(!attempt)fail('unauthenticated','Login expired or was already used.',401);
   const tokens=await oidc.authorizationCodeGrant(await provider(),url,{pkceCodeVerifier:decrypt(config.loginKey,attempt.verifier),expectedState:state,expectedNonce:attempt.nonce,idTokenExpected:true});
   const claims=tokens.claims();if(!claims?.sub)fail('unauthenticated','Verified OIDC identity is required.',401);
   const identity={issuer:config.issuer,subject:claims.sub,clientId:config.webClientId};await store.grant(identity);
   const session=random();await store.saveSession(hash(session),identity);
   return {cookies:[setCookie(sessionCookie,session,8*3600),setCookie(loginCookie,'',0)],channel:attempt.channel,returnTo:attempt.return_to};
  },
  async logout(cookies:string|undefined){const token=cookieValue(cookies,sessionCookie);if(token)await store.deleteSession(hash(token));return setCookie(sessionCookie,'',0);},
  sessionInfo(principal:Principal,cookies:string|undefined){const token=cookieValue(cookies,sessionCookie);if(!token)fail('unauthenticated','Web session required.',401);return {account_scope:hash('account\0'+verifyPrincipal(principal).user),csrf_token:csrfToken(config.csrfKey,token)};}
 };
}
export type Authentication=ReturnType<typeof createAuthentication>;
