import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isPublicAddress,normalizeCallbackUrl} from '../../lib/webhook/destination.ts';
import {parseSigningSecret,signature,signedHeaders} from '../../lib/webhook/signing.ts';
import {canonicalJson,createSubscriptions,grantedLifetime,subscriptionId,LIFETIME,PROOF_MS,SubscriptionError} from '../../lib/webhook/subscriptions.ts';
import {CallbackError} from '../../lib/webhook/ports.ts';
import {createWebhookCrypto} from '../../lib/server/node/webhook-crypto.ts';

const crypto=createWebhookCrypto({current:'k1',keys:{k1:new Uint8Array(32).fill(7)}});
const secret='whsec_'+Buffer.alloc(32,9).toString('base64'),otherSecret='whsec_'+Buffer.alloc(32,3).toString('base64');
const owner={issuer:'https://gate.example.test',subject:'person',clientId:'client',connectionId:'connection-1'};
const events=[{name:'changed',acceptsArguments:args=>Object.keys(args).length===0}];

test('only globally routable unicast addresses are public',()=>{
 for(const address of ['93.184.216.34','8.8.8.8','2606:4700:4700::1111','2a00:1450:4001:80b::200e'])assert.equal(isPublicAddress(address),true,address);
 for(const address of ['127.0.0.1','10.1.2.3','172.16.0.1','172.31.255.255','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','255.255.255.255','192.0.2.1','198.18.0.1','203.0.113.9',
  '::1','::','::ffff:127.0.0.1','::ffff:8.8.8.8','::ffff:7f00:1','64:ff9b::808:808','fe80::1','fc00::1','fd12:3456::1','ff02::1','2001:db8::1','2001::1','2002:c000:0204::1','::127.0.0.1','01.2.3.4','1.2.3','not-an-ip','1::2::3'])
  assert.equal(isPublicAddress(address),false,address);
});

test('callback URLs are public HTTPS serializations without credentials or fragments',()=>{
 assert.equal(normalizeCallbackUrl('https://Receiver.Example.com:443/hooks/a?x=1'),'https://receiver.example.com/hooks/a?x=1');
 assert.equal(normalizeCallbackUrl('https://93.184.216.34/h'),'https://93.184.216.34/h');
 for(const url of ['http://receiver.example.com/h','https://user:pass@receiver.example.com/h','https://receiver.example.com/h#f','https://localhost/h','https://127.0.0.1/h','https://0x7f.1/h','https://[::1]/h','https://[::ffff:10.0.0.1]/h','https://metadata.internal/h','https://printer.local/h','https://intranet/h','ftp://receiver.example.com',42,'https://'+'a'.repeat(2050)+'.example.com'])
  assert.equal(normalizeCallbackUrl(url),null,String(url));
});

test('signing secrets are canonical whsec_ base64 of 24 to 64 bytes',()=>{
 assert.equal(parseSigningSecret(secret).length,32);
 assert.equal(parseSigningSecret('whsec_'+Buffer.alloc(24).toString('base64')).length,24);
 for(const value of ['whsec_'+Buffer.alloc(23).toString('base64'),'whsec_'+Buffer.alloc(65).toString('base64'),secret.slice(6),'whsec_'+Buffer.alloc(32,9).toString('base64').replace(/=$/,''),'whsec_!!!!',null])
  assert.equal(parseSigningSecret(value),null,String(value));
});

test('signatures match the Standard Webhooks reference vector and cover exact body bytes',()=>{
 const key=parseSigningSecret('whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw');
 const body=new TextEncoder().encode('{"test": 2432232314}');
 assert.equal(signature(crypto,[key],'msg_p5jXN8AQM9LWM0D4loKWxJek',1614265330,body),'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=');
 const rotated=signature(crypto,[key,parseSigningSecret(secret)],'msg_p5jXN8AQM9LWM0D4loKWxJek',1614265330,body).split(' ');
 assert.equal(rotated.length,2);assert.equal(rotated[0],'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=');
 const headers=signedHeaders(crypto,{secrets:[key],webhookId:'evt_1',subscriptionId:'sub_1',timestamp:10,body});
 assert.deepEqual(Object.keys(headers).sort(),['content-type','webhook-id','webhook-signature','webhook-timestamp','x-mcp-subscription-id']);
 assert.notEqual(signedHeaders(crypto,{secrets:[key],webhookId:'evt_1',subscriptionId:'sub_1',timestamp:11,body})['webhook-signature'],headers['webhook-signature']);
});

test('identities ignore argument key order and exclude secret and lifetime; lifetimes stay finite and bounded',()=>{
 assert.equal(canonicalJson({b:1,a:{d:[1,{z:1,y:2}],c:null}}),'{"a":{"c":null,"d":[1,{"y":2,"z":1}]},"b":1}');
 const one=subscriptionId(crypto,owner,'changed','https://r.example.com/h',canonicalJson({a:1,b:2}));
 assert.equal(one,subscriptionId(crypto,owner,'changed','https://r.example.com/h',canonicalJson({b:2,a:1})));
 assert.notEqual(one,subscriptionId(crypto,{...owner,connectionId:'connection-2'},'changed','https://r.example.com/h',canonicalJson({a:1,b:2})));
 assert.match(one,/^sub_[0-9a-f]{64}$/);
 assert.equal(grantedLifetime(undefined),LIFETIME.defaultMs);assert.equal(grantedLifetime(null),LIFETIME.defaultMs);
 assert.equal(grantedLifetime(1),LIFETIME.minMs);assert.equal(grantedLifetime(1e15),LIFETIME.maxMs);assert.equal(grantedLifetime(3_600_000),3_600_000);
 for(const value of [0,-1,1.5,'60000',Number.NaN])assert.throws(()=>grantedLifetime(value),SubscriptionError);
});

function memoryStore(){
 const rows=new Map();
 return {rows,
  async find(id){const row=rows.get(id);return row?{id,state:row.state,generation:row.generation,expiresAt:row.expiresAt??null,secret:row.secret??null,secretDigest:row.secretDigest??null,proofExpiresAt:row.proofExpiresAt??null}:null;},
  async activate(value,expected){const row=rows.get(value.id);if((row?.generation??null)!==expected)return false;rows.set(value.id,{...value,state:'active',generation:(expected??0)+1});return true;},
  async refresh(id,generation,expiresAt){const row=rows.get(id);if(!row||row.state!=='active'||row.generation!==generation)return false;row.expiresAt=expiresAt;return true;},
  async stop(value){const row=rows.get(value.id);rows.set(value.id,{...(row??value),state:'stopped',generation:(row?.generation??0)+1,secret:null,expiresAt:null,previousSecret:null});},
 };
}
function echoTransport({echo=true,status=200,fail}={}){
 const requests=[];
 const transport=async(url,headers,body)=>{requests.push({url,headers,body:new TextDecoder().decode(body)});if(fail)throw fail;const challenge=JSON.parse(new TextDecoder().decode(body)).challenge;return {status,body:JSON.stringify({challenge:echo===true?challenge:echo}),truncated:false};};
 return {transport,requests};
}
const params=(extra={})=>({name:'changed',arguments:{},delivery:{mode:'webhook',url:'https://receiver.example.com/hooks',secret},...extra});

test('subscribe verifies a signed challenge before activation, then refreshes the same identity without another challenge',async()=>{
 let now=Date.parse('2026-10-30T00:00:00Z');const store=memoryStore(),{transport,requests}=echoTransport();
 const service=createSubscriptions({store,owner,crypto,transport,clock:()=>now,events});
 const first=await service.subscribe(params({_meta:{ignored:true}}));
 assert.deepEqual({cursor:first.cursor,truncated:first.truncated,refreshBefore:first.refreshBefore},{cursor:null,truncated:false,refreshBefore:'2026-10-31T00:00:00.000Z'});
 assert.equal(requests.length,1);const challenge=requests[0];
 assert.equal(JSON.parse(challenge.body).type,'verification');assert.equal(challenge.headers['x-mcp-subscription-id'],first.id);
 const key=parseSigningSecret(secret);
 assert.equal(challenge.headers['webhook-signature'],signature(crypto,[key],challenge.headers['webhook-id'],Number(challenge.headers['webhook-timestamp']),new TextEncoder().encode(challenge.body)));
 const row=store.rows.get(first.id);assert.equal(row.state,'active');assert(!JSON.stringify(row).includes(secret.slice(6)));
 assert.deepEqual(await crypto.open(row.secret,'webhook-secret/v1|'+first.id),key);
 now+=PROOF_MS*3;
 const again=await service.subscribe(params({ttlMs:3_600_000,delivery:{url:'https://RECEIVER.example.com/hooks',secret}}));
 assert.equal(again.id,first.id);assert.equal(requests.length,1);assert.equal(store.rows.size,1);assert.equal(store.rows.get(first.id).generation,1);
 assert.equal(again.refreshBefore,new Date(now+3_600_000).toISOString());
});

test('a failed or wrong echo leaves no active subscription and reports a categorized callback failure',async()=>{
 for(const [options,reason] of [[{echo:'wrong'},'challenge_failed'],[{status:500},'endpoint_rejected'],[{fail:new CallbackError('timeout')},'timeout'],[{fail:new CallbackError('endpoint_rejected')},'endpoint_rejected']]){
  const store=memoryStore(),{transport}=echoTransport(options);
  const service=createSubscriptions({store,owner,crypto,transport,clock:()=>0,events});
  await assert.rejects(service.subscribe(params()),error=>error instanceof SubscriptionError&&error.code==='callback_failed'&&error.reason===reason);
  assert.equal(store.rows.size,0);
 }
});

test('a changed secret is verified and keeps the previous secret for a bounded overlap',async()=>{
 const now=1_000_000;const store=memoryStore(),{transport,requests}=echoTransport();
 const service=createSubscriptions({store,owner,crypto,transport,clock:()=>now,events});
 const first=await service.subscribe(params());const original=store.rows.get(first.id).secret;
 await service.subscribe(params({delivery:{url:'https://receiver.example.com/hooks',secret:otherSecret}}));
 assert.equal(requests.length,2);const row=store.rows.get(first.id);
 assert.equal(row.generation,2);assert.deepEqual(row.previousSecret,original);assert.equal(row.previousUntil,new Date(now+600_000).toISOString());
});

test('unsubscribe is idempotent and a verification finishing after it cannot reactivate the stopped identity',async()=>{
 const store=memoryStore();let release;const gate=new Promise(resolve=>{release=resolve;});
 const transport=async(url,headers,body)=>{await gate;return {status:200,body:JSON.stringify({challenge:JSON.parse(new TextDecoder().decode(body)).challenge}),truncated:false};};
 const service=createSubscriptions({store,owner,crypto,transport,clock:()=>0,events});
 const pending=service.subscribe(params());
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(await service.unsubscribe({name:'changed',arguments:{},delivery:{mode:'webhook',url:'https://receiver.example.com/hooks'}}),{});
 assert.deepEqual(await service.unsubscribe({name:'changed',delivery:{url:'https://receiver.example.com/hooks'}}),{});
 release();
 await assert.rejects(pending,error=>error instanceof SubscriptionError&&error.code==='conflict');
 assert.equal([...store.rows.values()][0].state,'stopped');
});

test('invalid subscriptions are rejected before any callback request',async()=>{
 const store=memoryStore(),{transport,requests}=echoTransport();
 const service=createSubscriptions({store,owner,crypto,transport,clock:()=>0,events});
 for(const value of [null,params({name:'other'}),params({arguments:{filter:'x'}}),params({arguments:[]}),params({delivery:{mode:'poll',url:'https://receiver.example.com/h',secret}}),params({delivery:{url:'http://receiver.example.com/h',secret}}),params({delivery:{url:'https://10.0.0.1/h',secret}}),params({delivery:{url:'https://receiver.example.com/h',secret:'plain'}}),params({cursor:'evt_1'}),params({ttlMs:-5})])
  await assert.rejects(service.subscribe(value),error=>error instanceof SubscriptionError&&error.code==='invalid_params');
 assert.equal(requests.length,0);assert.equal(store.rows.size,0);
});

test('delivery outcomes: 2xx delivers, 410 ends the subscription, 413 and permanent 4xx end the delivery, the rest retries within bounds',async()=>{
 const {classifyAttempt,admitAttempt,afterRetry,DELIVERY_LIMITS}=await import('../../lib/webhook/delivery.ts');
 assert.equal(classifyAttempt({status:200}),'delivered');assert.equal(classifyAttempt({status:204}),'delivered');
 assert.equal(classifyAttempt({status:410}),'stop_subscription');
 for(const status of [413,400,401,404,302])assert.equal(classifyAttempt({status}),'failed',String(status));
 for(const status of [408,429,500,503])assert.equal(classifyAttempt({status}),'retry',String(status));
 assert.equal(classifyAttempt({failure:'timeout'}),'retry');assert.equal(classifyAttempt({failure:'endpoint_rejected'}),'retry');
 assert.equal(admitAttempt({attempts:DELIVERY_LIMITS.attempts-1,createdAt:0,now:1}),'send');
 assert.equal(admitAttempt({attempts:DELIVERY_LIMITS.attempts,createdAt:0,now:1}),'exhausted');
 assert.equal(admitAttempt({attempts:0,createdAt:0,now:DELIVERY_LIMITS.ageMs}),'exhausted');
 assert.equal(afterRetry({attempts:DELIVERY_LIMITS.attempts,createdAt:0,now:1}),'exhausted');assert.equal(afterRetry({attempts:1,createdAt:0,now:1}),'pending');
});
