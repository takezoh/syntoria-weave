import {createHash} from 'node:crypto';
import {fail} from '../../domain/core';
import {CallbackError,type CallbackTransport,type WebhookCrypto} from '../../webhook/ports';
import {FANOUT_PAGE,afterRetry,classifyAttempt} from '../../webhook/delivery';
import {signedHeaders} from '../../webhook/signing';
import {secretContext} from '../../webhook/subscriptions';
import type {AttemptResult,DeliveryAttempt,createWebhookDeliveries} from '../../adapters/postgres/webhook-delivery-store';
import type {BatchWakeup} from '../../adapters/postgres/webhook-outbox';
import type {ConnectionCheck} from './gate-connection';
import type {TaskQueue} from './cloud-tasks';

export const FANOUT_PATH='/internal/webhook-fanout',DELIVERY_PATH='/internal/webhook-delivery';
const encoder=new TextEncoder();
const taskName=(...parts:readonly (string|number)[])=>createHash('sha256').update(parts.map(String).join('\0')).digest('hex');

function strict(value:unknown,keys:readonly string[]){
 const body=value as Record<string,unknown>|null;
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!==[...keys].sort().join(',')||keys.some(key=>key==='position'?!Number.isSafeInteger(body[key])||(body[key] as number)<0:typeof body[key]!=='string'||!(body[key] as string).length))fail('invalid_input','Unexpected task body.',400);
 return body as Record<string,string|number>;
}

/**
 * Request-driven delivery. A precommit root task fans out committed deliveries in bounded pages; each delivery task checks
 * the subscription and Gate, signs the stored bytes with a fresh timestamp and sends once. Nothing runs between requests.
 */
export function createWebhookWorker({deliveries,tasks,gate,crypto,transport,clock=()=>Date.now()}:{
 deliveries:ReturnType<typeof createWebhookDeliveries>;tasks:TaskQueue;gate:ConnectionCheck;crypto:WebhookCrypto;transport:CallbackTransport;clock?:()=>number;
}) {
 const wakeup:BatchWakeup=({user,batchId})=>tasks(taskName('fanout',user,batchId,0),FANOUT_PATH,{user,batchId,position:0});

 async function attempt(value:DeliveryAttempt):Promise<AttemptResult> {
  const retry=(error:string):AttemptResult=>({state:afterRetry({attempts:value.attempts,createdAt:value.createdAt,now:clock()}),error,stop:null});
  let validity;
  try{validity=await gate({subject:value.owner.subject,connectionId:value.owner.connectionId,clientId:value.owner.clientId});}catch{return retry('gate_unknown');}
  if(validity==='invalid')return {state:'failed',error:'connection_invalid',stop:'connection'};
  const secrets:Uint8Array[]=[];
  try{
   secrets.push(await crypto.open(value.secret,secretContext(value.subscriptionId)));
   if(value.previousSecret&&value.previousUntil!==null&&value.previousUntil>clock())secrets.push(await crypto.open(value.previousSecret,secretContext(value.subscriptionId)));
  }catch{return retry('secret_unavailable');}
  const body=encoder.encode(value.body),eventId=String((JSON.parse(value.body) as {eventId:unknown}).eventId);
  const headers=signedHeaders(crypto,{secrets,webhookId:eventId,subscriptionId:value.subscriptionId,timestamp:Math.floor(clock()/1000),body});
  let outcome,error:string;
  try{const response=await transport(value.url,headers,body);outcome=classifyAttempt({status:response.status});error='status_'+response.status;}
  catch(failure){const reason=failure instanceof CallbackError?failure.reason:'endpoint_rejected';outcome=classifyAttempt({failure:reason});error='callback_'+reason;}
  if(outcome==='delivered')return {state:'delivered',error:null,stop:null};
  if(outcome==='stop_subscription')return {state:'failed',error,stop:'subscription'};
  if(outcome==='failed')return {state:'failed',error,stop:null};
  return retry(error);
 }

 return {
  wakeup,
  /** HTTP status for one fan-out task: 204 when done or the write rolled back; a thrown error leaves the task to retry. */
  async fanout(raw:unknown):Promise<number>{
   const {user,batchId}=strict(raw,['user','batchId','position']) as {user:string;batchId:string};
   if(!await deliveries.committed(user,batchId))return 204;
   await deliveries.fanout(user,batchId,FANOUT_PAGE,
    deliveryId=>tasks(taskName('delivery',user,deliveryId),DELIVERY_PATH,{user,deliveryId}),
    position=>tasks(taskName('fanout',user,batchId,position),FANOUT_PATH,{user,batchId,position}));
   await deliveries.prune(user);
   return 204;
  },
  /** HTTP status for one delivery task: 503 asks the queue to retry a pending delivery; every final state acknowledges. */
  async deliver(raw:unknown):Promise<number>{
   const {user,deliveryId}=strict(raw,['user','deliveryId']) as {user:string;deliveryId:string};
   return await deliveries.deliver(user,deliveryId,clock,attempt)==='pending'?503:204;
  },
  /** Schedules batches whose precommit wakeup failed; called on the user's authenticated requests. */
  async recover(user:string){
   for(const batchId of await deliveries.unscheduled(user,5)){await wakeup({user,batchId});await deliveries.scheduled(user,batchId);}
  },
 };
}
export type WebhookWorker=ReturnType<typeof createWebhookWorker>;
