import type {WebhookCrypto} from './ports';

const encoder=new TextEncoder();

/** The key bytes of a canonical `whsec_` Standard Webhooks secret of 24 to 64 bytes, or null. */
export function parseSigningSecret(value:unknown):Uint8Array|null {
 if(typeof value!=='string')return null;
 const encoded=/^whsec_([A-Za-z0-9+/]+={0,2})$/.exec(value)?.[1];
 if(!encoded||encoded.length%4!==0)return null;
 let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));}catch{return null;}
 if(bytes.length<24||bytes.length>64||base64(bytes)!==encoded)return null;
 return bytes;
}

export const base64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
export const hex=(bytes:Uint8Array)=>Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');

/** Standard Webhooks signature header: one `v1,` HMAC per secret over `id.timestamp.body`, space separated. */
export function signature(crypto:WebhookCrypto,secrets:readonly Uint8Array[],id:string,timestamp:number,body:Uint8Array){
 const prefix=encoder.encode(id+'.'+timestamp+'.'),message=new Uint8Array(prefix.length+body.length);
 message.set(prefix);message.set(body,prefix.length);
 return secrets.map(secret=>'v1,'+crypto.hmac(secret,message)).join(' ');
}

/** Headers of one signed POST. The body bytes are signed exactly as they are sent; the timestamp is the attempt's. */
export function signedHeaders(crypto:WebhookCrypto,{secrets,webhookId,subscriptionId,timestamp,body}:{secrets:readonly Uint8Array[];webhookId:string;subscriptionId:string;timestamp:number;body:Uint8Array}):Readonly<Record<string,string>> {
 return Object.freeze({
  'content-type':'application/json',
  'webhook-id':webhookId,
  'webhook-timestamp':String(timestamp),
  'webhook-signature':signature(crypto,secrets,webhookId,timestamp,body),
  'x-mcp-subscription-id':subscriptionId,
 });
}
