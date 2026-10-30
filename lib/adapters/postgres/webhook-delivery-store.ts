import type {Pool,PoolClient} from 'pg';
import {userLockKey} from './action-store';
import {lockSubscription} from './webhook-store';
import type {SealedSecret} from '../../webhook/ports';
import {admitAttempt} from '../../webhook/delivery';

/** Everything one admitted attempt needs; the secrets stay sealed until the sender opens them. */
export type DeliveryAttempt=Readonly<{
 deliveryId:string;subscriptionId:string;generation:number;url:string;body:string;attempts:number;createdAt:number;
 owner:Readonly<{issuer:string;subject:string;clientId:string;connectionId:string}>;
 secret:SealedSecret;previousSecret:SealedSecret|null;previousUntil:number|null;
}>;
export type AttemptResult=Readonly<{state:'delivered'|'failed'|'pending'|'exhausted';error:string|null;stop:'subscription'|'connection'|null}>;
export type DeliveryResult='absent'|'terminal'|'stopped'|'exhausted'|AttemptResult['state'];

async function transaction<T>(pool:Pool,run:(client:PoolClient)=>Promise<T>):Promise<T> {
 const client=await pool.connect();
 try{await client.query('BEGIN');const value=await run(client);await client.query('COMMIT');return value;}
 catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
 finally{client.release();}
}
const millis=(value:unknown)=>value instanceof Date?value.getTime():Number.NaN;

/**
 * Worker persistence for one user named by an authenticated task. Fan-out runs only on committed batches; each attempt holds
 * the subscription lock that unsubscribe also takes, so no POST starts after a stop is committed.
 */
export function createWebhookDeliveries(pool:Pool) {
 const stopSubscription=async(client:PoolClient,user:string,id:string)=>{
  await client.query("UPDATE state.webhook_subscriptions SET state='stopped',generation=generation+1,expires_at=NULL,secret_key_id=NULL,secret_ciphertext=NULL,previous_key_id=NULL,previous_ciphertext=NULL,previous_until=NULL,updated_at=now() WHERE user_id=$1 AND id=$2 AND state='active'",[user,id]);
  await client.query("UPDATE state.webhook_deliveries SET state='stopped',updated_at=now() WHERE user_id=$1 AND subscription_id=$2 AND state='pending'",[user,id]);
 };
 return {
  /** Waits behind the writing transaction: a missing batch after the user lock was rolled back, not delayed. */
  committed:(user:string,batchId:string)=>transaction(pool,async client=>{
   await client.query('SELECT pg_advisory_xact_lock($1::bigint)',[userLockKey(user)]);
   return !!(await client.query('SELECT 1 FROM state.webhook_batches WHERE user_id=$1 AND id=$2',[user,batchId])).rowCount;
  }),
  /** Creates delivery tasks for one bounded page from the contiguous cursor, then the continuation when work remains. */
  fanout:(user:string,batchId:string,page:number,create:(deliveryId:string)=>Promise<void>,continueAt:(position:number)=>Promise<void>)=>transaction(pool,async client=>{
   const batch=(await client.query('SELECT size,cursor FROM state.webhook_batches WHERE user_id=$1 AND id=$2 FOR UPDATE',[user,batchId])).rows[0];
   if(!batch)return 'absent' as const;
   let cursor=Number(batch.cursor);const size=Number(batch.size);
   for(const row of (await client.query('SELECT id,position FROM state.webhook_deliveries WHERE user_id=$1 AND batch_id=$2 AND position>=$3 ORDER BY position LIMIT $4',[user,batchId,cursor,page])).rows){
    await create(String(row.id));cursor=Number(row.position)+1;
   }
   await client.query('UPDATE state.webhook_batches SET cursor=$3 WHERE user_id=$1 AND id=$2',[user,batchId,cursor]);
   if(cursor<size){await continueAt(cursor);return 'continued' as const;}
   return 'complete' as const;
  }),
  /** Counts the admission durably, then attempts under the subscription lock and records the outcome. */
  async deliver(user:string,deliveryId:string,now:()=>number,attempt:(value:DeliveryAttempt)=>Promise<AttemptResult>):Promise<DeliveryResult> {
   const subscription=(await pool.query('SELECT subscription_id FROM state.webhook_deliveries WHERE user_id=$1 AND id=$2',[user,deliveryId])).rows[0]?.subscription_id;
   if(subscription===undefined)return 'absent';
   const load=async(client:PoolClient)=>{
    await lockSubscription(client,user,String(subscription));
    return (await client.query(`SELECT d.state,d.attempts,d.created_at,d.body,d.subscription_generation,s.state AS subscription_state,s.generation,s.expires_at,s.url,s.issuer,s.subject,s.client_id,s.connection_id,s.secret_key_id,s.secret_ciphertext,s.previous_key_id,s.previous_ciphertext,s.previous_until
     FROM state.webhook_deliveries d JOIN state.webhook_subscriptions s ON s.user_id=d.user_id AND s.id=d.subscription_id WHERE d.user_id=$1 AND d.id=$2 FOR UPDATE OF d`,[user,deliveryId])).rows[0];
   };
   const usable=(row:Record<string,unknown>)=>row.subscription_state==='active'&&Number(row.generation)===Number(row.subscription_generation)&&millis(row.expires_at)>now();
   const admitted=await transaction(pool,async client=>{
    const row=await load(client);
    if(row.state!=='pending')return 'terminal' as const;
    if(!usable(row)){await client.query("UPDATE state.webhook_deliveries SET state='stopped',updated_at=now() WHERE user_id=$1 AND id=$2",[user,deliveryId]);return 'stopped' as const;}
    if(admitAttempt({attempts:Number(row.attempts),createdAt:millis(row.created_at),now:now()})==='exhausted'){await client.query("UPDATE state.webhook_deliveries SET state='exhausted',updated_at=now() WHERE user_id=$1 AND id=$2",[user,deliveryId]);return 'exhausted' as const;}
    await client.query('UPDATE state.webhook_deliveries SET attempts=attempts+1,updated_at=now() WHERE user_id=$1 AND id=$2',[user,deliveryId]);
    return 'admitted' as const;
   });
   if(admitted!=='admitted')return admitted;
   return transaction(pool,async client=>{
    const row=await load(client);
    if(row.state!=='pending')return 'terminal';
    if(!usable(row)){await client.query("UPDATE state.webhook_deliveries SET state='stopped',updated_at=now() WHERE user_id=$1 AND id=$2",[user,deliveryId]);return 'stopped';}
    const result=await attempt({deliveryId,subscriptionId:String(subscription),generation:Number(row.generation),url:String(row.url),body:String(row.body),attempts:Number(row.attempts),createdAt:millis(row.created_at),
     owner:{issuer:String(row.issuer),subject:String(row.subject),clientId:String(row.client_id),connectionId:String(row.connection_id)},
     secret:{keyId:String(row.secret_key_id),ciphertext:String(row.secret_ciphertext)},
     previousSecret:row.previous_ciphertext===null?null:{keyId:String(row.previous_key_id),ciphertext:String(row.previous_ciphertext)},previousUntil:row.previous_until===null?null:millis(row.previous_until)});
    if(result.stop==='connection'){
     for(const other of (await client.query("SELECT id FROM state.webhook_subscriptions WHERE user_id=$1 AND issuer=$2 AND subject=$3 AND connection_id=$4 AND state='active' ORDER BY id",[user,row.issuer,row.subject,row.connection_id])).rows)await stopSubscription(client,user,String(other.id));
    }else if(result.stop==='subscription')await stopSubscription(client,user,String(subscription));
    const state=result.stop?'stopped':result.state;
    await client.query('UPDATE state.webhook_deliveries SET state=$3,last_error=$4,updated_at=now() WHERE user_id=$1 AND id=$2',[user,deliveryId,state,result.error]);
    return state;
   });
  },
  /** Batches whose precommit wakeup failed, oldest first; recovered on the user's next authenticated request. */
  unscheduled:async(user:string,limit:number)=>(await pool.query("SELECT id FROM state.webhook_batches WHERE user_id=$1 AND enqueue_state='not_enqueued' ORDER BY created_at,id LIMIT $2",[user,limit])).rows.map(row=>String(row.id)),
  scheduled:async(user:string,batchId:string)=>{await pool.query("UPDATE state.webhook_batches SET enqueue_state='enqueued' WHERE user_id=$1 AND id=$2",[user,batchId]);},
  /** Deletes a bounded number of finished batches older than the queue's retry and deduplication horizon. */
  prune:async(user:string)=>{await pool.query("DELETE FROM state.webhook_batches WHERE user_id=$1 AND id IN (SELECT b.id FROM state.webhook_batches b WHERE b.user_id=$1 AND b.created_at<now()-interval '7 days' AND NOT EXISTS (SELECT 1 FROM state.webhook_deliveries d WHERE d.user_id=b.user_id AND d.batch_id=b.id AND d.state='pending') ORDER BY b.created_at LIMIT 20)",[user]);},
 };
}
