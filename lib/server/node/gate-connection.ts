/** Whether Gate still authorizes an exact OAuth connection; anything Gate does not answer authoritatively is unknown. */
export type ConnectionValidity='valid'|'invalid';
export type ConnectionCheck=(input:Readonly<{subject:string;connectionId:string;clientId:string}>)=>Promise<ConnectionValidity>;
export class ConnectionCheckUnknown extends Error {
 constructor(){super('Gate connection validity is unknown.');this.name='ConnectionCheckUnknown';}
}

function formEncode(value:string){
 return encodeURIComponent(value).replace(/[!'()*]/g,char=>`%${char.charCodeAt(0).toString(16).toUpperCase()}`).replace(/%20/g,'+');
}

/**
 * Resource-authenticated online check of one connection (proposed Gate contract: POST /connections/check). There is no
 * positive cache; outages, credential rejection and malformed answers never become valid or invalid.
 */
export function createGateConnectionCheck({issuer,clientId,clientSecret,fetch:fetcher=globalThis.fetch,timeoutMs=3_000,allowLoopbackHttp=false}:{
 issuer:string;clientId:string;clientSecret:string;fetch?:typeof fetch;timeoutMs?:number;allowLoopbackHttp?:boolean;
}):ConnectionCheck {
 if(allowLoopbackHttp&&process.env.NODE_ENV==='production')throw new TypeError('Loopback HTTP is forbidden in production');
 const base=new URL(issuer),loopback=['localhost','127.0.0.1','[::1]'].includes(base.hostname);
 if(base.username||base.password||base.search||base.hash||(base.protocol!=='https:'&&!(allowLoopbackHttp&&loopback&&base.protocol==='http:')))throw new TypeError('Gate requires an HTTPS issuer without credentials, query or fragment');
 const endpoint=new URL('/connections/check',base).href;
 const authorization='Basic '+Buffer.from(formEncode(clientId)+':'+formEncode(clientSecret),'utf8').toString('base64');
 return async({subject,connectionId,clientId:connectionClient})=>{
  let response:Response;
  try{response=await fetcher(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{authorization,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({subject,connection_id:connectionId,client_id:connectionClient})});}
  catch{throw new ConnectionCheckUnknown();}
  if(response.status!==200||response.redirected||response.headers.get('content-type')?.split(';',1)[0]?.trim().toLowerCase()!=='application/json'){await response.body?.cancel().catch(()=>{});throw new ConnectionCheckUnknown();}
  let value:unknown;try{value=await response.json();}catch{throw new ConnectionCheckUnknown();}
  const valid=(value as {valid?:unknown}|null)?.valid;
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof valid!=='boolean')throw new ConnectionCheckUnknown();
  return valid?'valid':'invalid';
 };
}
