import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';
import {fail} from '../../domain/core';

const GOOGLE_KEYS=new URL('https://www.googleapis.com/oauth2/v3/certs');

/** Accepts only a Google-signed OIDC token for the dedicated task identity and this service's task audience. */
export function createTaskAuthentication({audience,serviceAccount,keys=createRemoteJWKSet(GOOGLE_KEYS)}:{audience:string;serviceAccount:string;keys?:JWTVerifyGetKey}){
 return async(authorization:string|undefined)=>{
  const token=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(authorization??'')?.[1];
  if(!token)fail('unauthenticated','Task authentication is required.',401);
  let payload;
  try{({payload}=await jwtVerify(token,keys,{issuer:['https://accounts.google.com','accounts.google.com'],audience,algorithms:['RS256']}));}
  catch{fail('unauthenticated','Task authentication is required.',401);}
  if(payload.email!==serviceAccount||payload.email_verified!==true)fail('forbidden','This task identity is not allowed.',403);
 };
}
