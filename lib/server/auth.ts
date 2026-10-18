import {fail} from '../domain/core';

declare const identityBrand: unique symbol;
export type VerifiedIdentity = Readonly<{user:string;[identityBrand]:true}>;
// Capabilities are issued only by this request boundary, not by structural casts.
const issued = new WeakSet<object>();
export function requireUser(headers:Headers):VerifiedIdentity {
 const user=headers.get('oai-authenticated-user-id');
 if(!user||user.trim()!==user||user.length>512||!headers.get('oai-authenticated-user-email'))fail('unauthenticated','ChatGPTへの接続が必要です。',401);
 const identity=Object.freeze({user}) as VerifiedIdentity;issued.add(identity);return identity;
}
export function verifiedUser(identity:VerifiedIdentity):string {
 if(!identity||!issued.has(identity))fail('unauthenticated','Verified request identity is required.',401);
 return identity.user;
}
