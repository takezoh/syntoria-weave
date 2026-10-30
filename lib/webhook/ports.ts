/** Effects of the webhook mechanics. Adapters own cryptography, storage and the network; this module only decides. */

/** An encrypted signing secret; the key ring that opens it is never stored beside it. */
export type SealedSecret=Readonly<{keyId:string;ciphertext:string}>;

export type WebhookCrypto=Readonly<{
 /** Lowercase hexadecimal SHA-256 of UTF-8 text. */
 sha256(text:string):string;
 /** Base64 HMAC-SHA256 of a message. */
 hmac(key:Uint8Array,message:Uint8Array):string;
 random(bytes:number):Uint8Array;
 /** Constant-time comparison of two strings. */
 equal(left:string,right:string):boolean;
 seal(secret:Uint8Array,aad:string):Promise<SealedSecret>;
 open(sealed:SealedSecret,aad:string):Promise<Uint8Array>;
}>;

export type CallbackResponse=Readonly<{status:number;body:string;truncated:boolean}>;
export type CallbackFailureReason='timeout'|'endpoint_rejected';
/** A destination or transport failure; no request reached a callback that was not public. */
export class CallbackError extends Error {
 constructor(readonly reason:CallbackFailureReason){super('Callback '+reason);this.name='CallbackError';}
}
/** Sends one POST to a validated public HTTPS callback without following redirects. */
export type CallbackTransport=(url:string,headers:Readonly<Record<string,string>>,body:Uint8Array)=>Promise<CallbackResponse>;

/** The verified connection a subscription belongs to; supplied by authentication, never by request arguments. */
export type SubscriptionOwner=Readonly<{issuer:string;subject:string;clientId:string;connectionId:string}>;

export type SubscriptionRecord=Readonly<{
 id:string;state:'active'|'stopped';generation:number;expiresAt:string|null;
 secret:SealedSecret|null;secretDigest:string|null;proofExpiresAt:string|null;
}>;
export type Activation=Readonly<{
 id:string;eventName:string;arguments:string;url:string;expiresAt:string;
 secret:SealedSecret;secretDigest:string;proofExpiresAt:string;
 previousSecret:SealedSecret|null;previousUntil:string|null;
}>;

/** Persistence of one connection's subscriptions; every call is bound to that connection's user. */
export interface SubscriptionStore {
 find(id:string):Promise<SubscriptionRecord|null>;
 /** Activates a verified subscription when its generation is still `expected` (null: no record). False on a concurrent change. */
 activate(value:Activation,expected:number|null):Promise<boolean>;
 /** Extends an active subscription of `generation`. False when it changed or stopped meanwhile. */
 refresh(id:string,generation:number,expiresAt:string):Promise<boolean>;
 /** Stops the subscription and advances its generation, recording a stopped identity when none exists. */
 stop(value:Readonly<{id:string;eventName:string;arguments:string;url:string}>):Promise<void>;
}
