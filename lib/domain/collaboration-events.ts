import {assignmentReason} from './collaboration';
import type {Collaboration,CollaborationActor} from '../data/types';

type EventSnapshot=Readonly<{actions:readonly Readonly<{id:string;status:string}>[];collaborations?:readonly Collaboration[]}>;
/** A connection subscribed to collaboration changes; `generation` pins the subscription the event belongs to. */
export type CollaborationSubscriber=Readonly<{id:string;generation:number;actor:CollaborationActor}>;
export type CollaborationEvent=Readonly<{subscriptionId:string;generation:number;collaborationId:string;actionId:string|null}>;

/**
 * Subscribers a committed change concerns. A record counts when it or its Action changed, and a subscriber when the
 * record concerned its connection before or after the change, so withdrawal and reassignment reach the former handler.
 * The writing connection is not told about its own change.
 */
export function collaborationEvents({before,after,record,subscribers,writer}:{
 before:EventSnapshot;after:EventSnapshot;record:Collaboration|null;subscribers:readonly CollaborationSubscriber[];writer:CollaborationActor;
}):CollaborationEvent[] {
 if(!subscribers.length)return [];
 const statusBefore=new Map(before.actions.map(action=>[action.id,action.status])),statusAfter=new Map(after.actions.map(action=>[action.id,action.status]));
 const previous=new Map((before.collaborations??[]).map(item=>[item.id,item]));
 const current=new Map((after.collaborations??[]).map(item=>[item.id,item]));
 if(record)current.set(record.id,record);
 const events:CollaborationEvent[]=[];
 for(const [id,next] of current){
  const prior=previous.get(id)??null,actionId=next.action_id;
  const actionChanged=actionId!==null&&statusBefore.get(actionId)!==statusAfter.get(actionId);
  if(!actionChanged&&prior!==null&&JSON.stringify(prior)===JSON.stringify(next))continue;
  for(const subscriber of subscribers){
   const actor=subscriber.actor;
   if(actor.kind===writer.kind&&actor.client_id===writer.client_id&&actor.connection_id===writer.connection_id)continue;
   const was=prior!==null&&assignmentReason(prior,actor,prior.action_id===null?undefined:statusBefore.get(prior.action_id))!==null;
   const is=assignmentReason(next,actor,actionId===null?undefined:statusAfter.get(actionId))!==null;
   if(was||is)events.push({subscriptionId:subscriber.id,generation:subscriber.generation,collaborationId:id,actionId});
  }
 }
 return events;
}
