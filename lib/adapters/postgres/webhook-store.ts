import type {Pool,PoolClient} from 'pg';
import type {SubscriptionRecord,SubscriptionStore} from '../../webhook/ports';
import {verifyPrincipal,type Principal} from '../../server/node/principal';

const iso=(value:unknown)=>value instanceof Date?value.toISOString():null;

/** Serializes a subscription's stop with any delivery attempt in flight; the two-key form never meets the user commit lock. */
export async function lockSubscription(client:PoolClient,user:string,id:string){
 await client.query("SELECT pg_advisory_xact_lock(hashtext('webhook-subscription'),hashtext($1))",[JSON.stringify([user,id])]);
}

/** Webhook subscriptions of one verified connection; every statement is bound to the principal's user and connection. */
export function createWebhookSubscriptions(pool:Pool):(principal:Principal)=>SubscriptionStore {
 return principal=>{
  const p=verifyPrincipal(principal);
  return {
   async find(id){
    const row=(await pool.query('SELECT id,state,generation,expires_at,secret_key_id,secret_ciphertext,secret_digest,proof_expires_at FROM state.webhook_subscriptions WHERE user_id=$1 AND id=$2 AND connection_id=$3',[p.user,id,p.connectionId])).rows[0];
    if(!row)return null;
    return {id:String(row.id),state:row.state,generation:Number(row.generation),expiresAt:iso(row.expires_at),
     secret:row.secret_ciphertext===null?null:{keyId:String(row.secret_key_id),ciphertext:String(row.secret_ciphertext)},
     secretDigest:row.secret_digest===null?null:String(row.secret_digest),proofExpiresAt:iso(row.proof_expires_at)} satisfies SubscriptionRecord;
   },
   async activate(value,expected){
    const fields=[value.eventName,value.arguments,value.url,value.expiresAt,value.secret.keyId,value.secret.ciphertext,value.secretDigest,value.previousSecret?.keyId??null,value.previousSecret?.ciphertext??null,value.previousUntil,value.proofExpiresAt];
    if(expected===null)return (await pool.query(`INSERT INTO state.webhook_subscriptions(user_id,id,issuer,subject,client_id,connection_id,event_name,canonical_arguments,url,state,generation,expires_at,secret_key_id,secret_ciphertext,secret_digest,previous_key_id,previous_ciphertext,previous_until,proof_expires_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',1,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT(user_id,id) DO NOTHING`,[p.user,value.id,p.issuer,p.subject,p.clientId,p.connectionId,...fields])).rowCount===1;
    return (await pool.query(`UPDATE state.webhook_subscriptions SET event_name=$4,canonical_arguments=$5,url=$6,state='active',generation=generation+1,expires_at=$7,secret_key_id=$8,secret_ciphertext=$9,secret_digest=$10,previous_key_id=$11,previous_ciphertext=$12,previous_until=$13,proof_expires_at=$14,updated_at=now()
     WHERE user_id=$1 AND id=$2 AND connection_id=$15 AND generation=$3`,[p.user,value.id,expected,...fields,p.connectionId])).rowCount===1;
   },
   async refresh(id,generation,expiresAt){
    return (await pool.query("UPDATE state.webhook_subscriptions SET expires_at=$4,updated_at=now() WHERE user_id=$1 AND id=$2 AND connection_id=$5 AND generation=$3 AND state='active'",[p.user,id,generation,expiresAt,p.connectionId])).rowCount===1;
   },
   async stop(value){
    const client=await pool.connect();
    try{
     await client.query('BEGIN');
     await lockSubscription(client,p.user,value.id);
     await client.query(`INSERT INTO state.webhook_subscriptions(user_id,id,issuer,subject,client_id,connection_id,event_name,canonical_arguments,url,state,generation)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'stopped',1)
      ON CONFLICT(user_id,id) DO UPDATE SET state='stopped',generation=state.webhook_subscriptions.generation+1,expires_at=NULL,secret_key_id=NULL,secret_ciphertext=NULL,previous_key_id=NULL,previous_ciphertext=NULL,previous_until=NULL,updated_at=now()
      WHERE state.webhook_subscriptions.connection_id=excluded.connection_id`,[p.user,value.id,p.issuer,p.subject,p.clientId,p.connectionId,value.eventName,value.arguments,value.url]);
     await client.query("UPDATE state.webhook_deliveries SET state='stopped',updated_at=now() WHERE user_id=$1 AND subscription_id=$2 AND state='pending'",[p.user,value.id]);
     await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
    finally{client.release();}
   },
  };
 };
}
