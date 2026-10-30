import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import type {WebhookCrypto} from '../../webhook/ports';

/** Keys that encrypt stored signing secrets. New secrets use `current`; older keys stay until every row is re-encrypted. */
export type KeyRing=Readonly<{current:string;keys:Readonly<Record<string,Uint8Array>>}>;

/** Parses `{"current":"<id>","keys":{"<id>":"<base64 32 bytes>"}}`. */
export function parseKeyRing(value:string):KeyRing {
 let parsed:unknown;try{parsed=JSON.parse(value);}catch{throw new Error('The webhook key ring must be JSON.');}
 const ring=parsed as {current?:unknown;keys?:unknown};
 if(!ring||typeof ring.current!=='string'||!ring.keys||typeof ring.keys!=='object'||Array.isArray(ring.keys))throw new Error('The webhook key ring needs a current key ID and keys.');
 const keys:Record<string,Uint8Array>={};
 for(const [id,encoded] of Object.entries(ring.keys as Record<string,unknown>)){
  const key=typeof encoded==='string'?Buffer.from(encoded,'base64'):null;
  if(!/^[A-Za-z0-9_-]{1,32}$/.test(id)||!key||key.length!==32||key.toString('base64')!==encoded)throw new Error('Each webhook key needs a short ID and 32 base64 bytes.');
  keys[id]=new Uint8Array(key);
 }
 if(!keys[ring.current])throw new Error('The current webhook key is missing.');
 return Object.freeze({current:ring.current,keys:Object.freeze(keys)});
}

const digest=(value:Buffer)=>createHash('sha256').update(value).digest();

/** Node cryptography for webhook mechanics: AES-256-GCM sealing bound to its AAD, HMAC-SHA256 and constant-time comparison. */
export function createWebhookCrypto(ring:KeyRing):WebhookCrypto {
 return Object.freeze({
  sha256:text=>createHash('sha256').update(text,'utf8').digest('hex'),
  hmac:(key,message)=>createHmac('sha256',key).update(message).digest('base64'),
  random:bytes=>new Uint8Array(randomBytes(bytes)),
  equal:(left,right)=>{const a=Buffer.from(left,'utf8'),b=Buffer.from(right,'utf8');return timingSafeEqual(digest(a),digest(b))&&a.length===b.length;},
  async seal(secret,aad){
   const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',ring.keys[ring.current]!,nonce);cipher.setAAD(Buffer.from(aad,'utf8'));
   const body=Buffer.concat([cipher.update(secret),cipher.final()]);
   return {keyId:ring.current,ciphertext:Buffer.concat([nonce,cipher.getAuthTag(),body]).toString('base64')};
  },
  async open(sealed,aad){
   const key=ring.keys[sealed.keyId];if(!key)throw new Error('Unknown webhook secret key.');
   const raw=Buffer.from(sealed.ciphertext,'base64');if(raw.length<29)throw new Error('Malformed webhook secret.');
   const decipher=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));decipher.setAAD(Buffer.from(aad,'utf8'));decipher.setAuthTag(raw.subarray(12,28));
   return new Uint8Array(Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]));
  },
 });
}
