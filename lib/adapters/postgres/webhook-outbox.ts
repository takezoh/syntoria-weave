import type {PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import {collaborationEvents} from '../../domain/collaboration-events';
import {COLLABORATION_CHANGED} from '../../mcp/event-definitions';
import type {Collaboration,CollaborationActor,Snapshot} from '../../data/types';

/** Schedules the durable wakeup of one committed write batch; it throws when the queue did not confirm the task. */
export type BatchWakeup=(task:Readonly<{user:string;batchId:string}>)=>Promise<void>;

const digest=(...parts:readonly (string|number)[])=>createHash('sha256').update(parts.map(String).join('\0')).digest('hex');
export const batchId=(user:string,operationId:string)=>'wb_'+digest('webhook-batch/v1',user,operationId);

/**
 * Records, inside the business transaction, one identifier-only event per concerned subscription and changed record, and
 * attempts the batch's single wakeup before COMMIT. A wakeup that fails leaves the batch for authenticated-request recovery.
 */
export async function recordCollaborationEvents(client:PoolClient,{user,operationId,revision,now,before,after,record,writer,wakeup}:{
 user:string;operationId:string;revision:number;now:string;before:Snapshot;after:Snapshot;record:Collaboration|null;writer:CollaborationActor;wakeup?:BatchWakeup;
}) {
 const subscribers=(await client.query("SELECT id,generation,client_id,connection_id FROM state.webhook_subscriptions WHERE user_id=$1 AND state='active' AND expires_at>now() ORDER BY id",[user])).rows
  .map(row=>({id:String(row.id),generation:Number(row.generation),actor:{kind:'client' as const,client_id:String(row.client_id),connection_id:String(row.connection_id)}}));
 const events=collaborationEvents({before,after,record,subscribers,writer});
 if(!events.length)return;
 const id=batchId(user,operationId);
 await client.query("INSERT INTO state.webhook_batches(user_id,id,operation_id,revision,size,enqueue_state) VALUES($1,$2,$3,$4,$5,'not_enqueued')",[user,id,operationId,revision,events.length]);
 for(const [position,event] of events.entries()){
  const eventId='evt_'+digest('webhook-event/v1',user,event.subscriptionId,event.generation,event.collaborationId,revision);
  const body=JSON.stringify({eventId,name:COLLABORATION_CHANGED,timestamp:now,data:{collaboration_id:event.collaborationId,action_id:event.actionId,revision},cursor:null});
  await client.query("INSERT INTO state.webhook_deliveries(user_id,id,batch_id,position,subscription_id,subscription_generation,body,state) VALUES($1,$2,$3,$4,$5,$6,$7,'pending')",[user,eventId,id,position,event.subscriptionId,event.generation,body]);
 }
 if(!wakeup)return;
 try{await wakeup({user,batchId:id});}catch{return;}
 await client.query("UPDATE state.webhook_batches SET enqueue_state='enqueued' WHERE user_id=$1 AND id=$2",[user,id]);
}
