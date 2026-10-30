import {CallbackError,type CallbackFailureReason,type CallbackTransport,type SubscriptionOwner,type SubscriptionStore,type WebhookCrypto} from './ports';
import {normalizeCallbackUrl} from './destination';
import {base64,hex,parseSigningSecret,signedHeaders} from './signing';

export const LIFETIME={defaultMs:24*3_600_000,minMs:5*60_000,maxMs:7*24*3_600_000} as const;
/** A verified callback is trusted again without a new challenge for this long, for the same connection, URL and secret. */
export const PROOF_MS=5*60_000;
/** After a verified secret change, deliveries are also signed with the previous secret for this long. */
export const ROTATION_OVERLAP_MS=10*60_000;

/** An event a subscriber may request, with its accepted arguments. Meaning and payload belong to the caller. */
export type EventDefinition=Readonly<{name:string;acceptsArguments(value:Readonly<Record<string,unknown>>):boolean}>;
export type SubscribeResult=Readonly<{id:string;refreshBefore:string;cursor:null;truncated:false}>;
export type SubscriptionFailure='invalid_params'|'callback_failed'|'conflict';
export class SubscriptionError extends Error {
 constructor(readonly code:SubscriptionFailure,message:string,readonly reason?:CallbackFailureReason|'challenge_failed'){super(message);this.name='SubscriptionError';}
}

const encoder=new TextEncoder();
/** The additional authenticated data that binds a sealed signing secret to its subscription. */
export const secretContext=(id:string)=>'webhook-secret/v1|'+id;
const invalid=(message:string)=>new SubscriptionError('invalid_params',message);
const record=(value:unknown)=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;

/** JSON with object keys in code-unit order at every depth, so key order never changes an identity. */
export function canonicalJson(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
 const object=record(value);
 if(object)return '{'+Object.keys(object).sort().map(key=>JSON.stringify(key)+':'+canonicalJson(object[key])).join(',')+'}';
 return JSON.stringify(value);
}

/** Versioned, length-delimited identity of a connection's subscription; secrets and lifetimes are excluded. */
export function subscriptionId(crypto:WebhookCrypto,owner:SubscriptionOwner,eventName:string,url:string,args:string){
 const fields=['webhook-subscription/v1',owner.issuer,owner.subject,owner.clientId,owner.connectionId,eventName,url,args];
 return 'sub_'+crypto.sha256(fields.map(field=>field.length+':'+field).join(''));
}

/** The granted lifetime: omitted or null requests the default, and requests are clamped to the server bounds. */
export function grantedLifetime(value:unknown):number {
 if(value===undefined||value===null)return LIFETIME.defaultMs;
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<=0)throw invalid('ttlMs must be a positive integer or null.');
 return Math.min(LIFETIME.maxMs,Math.max(LIFETIME.minMs,value));
}

function target(events:readonly EventDefinition[],params:Record<string,unknown>){
 const event=events.find(item=>item.name===params.name);
 if(!event)throw invalid('Unknown event.');
 const args=params.arguments===undefined?{}:record(params.arguments);
 if(!args||!event.acceptsArguments(args))throw invalid('Event arguments are not accepted.');
 const delivery=record(params.delivery);
 if(!delivery||(delivery.mode!==undefined&&delivery.mode!=='webhook'))throw invalid('Only webhook delivery is supported.');
 const url=normalizeCallbackUrl(delivery.url);
 if(!url)throw invalid('The callback must be a public HTTPS URL without credentials or fragment.');
 return {event,args:canonicalJson(args),url,delivery};
}

/** Subscription lifecycle for one verified connection. Verification never runs while state is locked. */
export function createSubscriptions({store,owner,crypto,transport,clock,events}:{
 store:SubscriptionStore;owner:SubscriptionOwner;crypto:WebhookCrypto;transport:CallbackTransport;clock:()=>number;events:readonly EventDefinition[];
}){
 const iso=(ms:number)=>new Date(ms).toISOString();
 const callbackFailed=(reason:CallbackFailureReason|'challenge_failed')=>new SubscriptionError('callback_failed','Callback verification failed.',reason);

 async function verify(url:string,secret:Uint8Array,id:string){
  const challenge=base64(crypto.random(32)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const body=encoder.encode(JSON.stringify({type:'verification',challenge}));
  const headers=signedHeaders(crypto,{secrets:[secret],webhookId:'msg_'+hex(crypto.random(16)),subscriptionId:id,timestamp:Math.floor(clock()/1000),body});
  let response;
  try{response=await transport(url,headers,body);}catch(error){if(error instanceof CallbackError)throw callbackFailed(error.reason);throw error;}
  if(response.status<200||response.status>299)throw callbackFailed('endpoint_rejected');
  let echoed:unknown;try{echoed=record(JSON.parse(response.body))?.challenge;}catch{echoed=undefined;}
  if(response.truncated||typeof echoed!=='string'||!crypto.equal(echoed,challenge))throw callbackFailed('challenge_failed');
 }

 return {
  async subscribe(raw:unknown):Promise<SubscribeResult>{
   const params=record(raw);if(!params)throw invalid('Parameters are required.');
   const {event,args,url,delivery}=target(events,params);
   const secret=parseSigningSecret(delivery.secret);
   if(!secret)throw invalid('The signing secret must be a whsec_ value decoding to 24-64 bytes.');
   if(params.cursor!==undefined&&params.cursor!==null)throw invalid('This event does not support replay; cursor must be null.');
   const lifetime=grantedLifetime(params.ttlMs);
   const id=subscriptionId(crypto,owner,event.name,url,args);
   const digest=crypto.sha256('webhook-secret/v1:'+id+':'+base64(secret));
   const now=clock(),expiresAt=iso(now+lifetime),current=await store.find(id);
   const sameSecret=current?.secretDigest!=null&&crypto.equal(current.secretDigest,digest);
   const result:SubscribeResult={id,refreshBefore:expiresAt,cursor:null,truncated:false};
   if(current?.state==='active'&&sameSecret){
    if(await store.refresh(id,current.generation,expiresAt))return result;
    throw new SubscriptionError('conflict','The subscription changed concurrently. Repeat the request.');
   }
   const proven=sameSecret&&current?.proofExpiresAt!=null&&Date.parse(current.proofExpiresAt)>now;
   if(!proven)await verify(url,secret,id);
   const rotating=current?.state==='active'&&current.secret!==null;
   const activated=await store.activate({
    id,eventName:event.name,arguments:args,url,expiresAt,secret:await crypto.seal(secret,secretContext(id)),secretDigest:digest,
    proofExpiresAt:proven?current!.proofExpiresAt!:iso(now+PROOF_MS),
    previousSecret:rotating?current!.secret:null,previousUntil:rotating?iso(now+ROTATION_OVERLAP_MS):null,
   },current?.generation??null);
   if(!activated)throw new SubscriptionError('conflict','The subscription changed concurrently. Repeat the request.');
   return result;
  },
  async unsubscribe(raw:unknown):Promise<Record<string,never>>{
   const params=record(raw);if(!params)throw invalid('Parameters are required.');
   const {event,args,url}=target(events,params);
   await store.stop({id:subscriptionId(crypto,owner,event.name,url,args),eventName:event.name,arguments:args,url});
   return {};
  },
 };
}
