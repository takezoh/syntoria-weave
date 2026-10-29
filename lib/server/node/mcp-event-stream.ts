import {Readable} from 'node:stream';
import {setTimeout as delay} from 'node:timers/promises';
import {ASSIGNED_RESOURCE_URI,STATE_RESOURCE_URI,assignedUpdated,stateUpdated} from '../../mcp/state-resource';
import type {ChangePage} from '../../data/model/change-cursor';

export type EventStreamPorts={
 poll(cursor:string):Promise<ChangePage>;
 /** The resources this connection currently subscribes to; empty ends the stream. */
 subscriptions():Promise<readonly string[]>;
 /** A comparable value of this connection's assigned content; called only while that resource is subscribed. */
 assigned():Promise<string>;
};
/** Bounded live transport; durable cursors and receipts, not this process, own recovery. */
export function mcpEventStream(initial:ChangePage,ports:EventStreamPorts,{signal,intervalMs=2000,lifetimeMs=25000}:{signal:AbortSignal;intervalMs?:number;lifetimeMs?:number}){
 async function* messages(){
  let page=initial,assigned:string|null=null;const deadline=Date.now()+lifetimeMs;
  const frame=(data:unknown)=>`id: ${page.next_cursor}\nevent: message\ndata: ${JSON.stringify(data)}\n\n`;
  try{
   yield 'retry: 2000\n\n';
   // Every connection starts with a refresh hint for each subscribed resource, including an idle/reconnected stream.
   let first=true;
   while(!signal.aborted){
    const resources=await ports.subscriptions();if(!resources.length)return;
    if(resources.includes(STATE_RESOURCE_URI))yield frame(stateUpdated(page.next_cursor,page.through_revision));
    if(resources.includes(ASSIGNED_RESOURCE_URI)){
     // The assigned resource changes only for this connection's work, so compare its content, not the revision.
     const current=await ports.assigned();
     if(first||current!==assigned)yield frame(assignedUpdated(page.through_revision));
     assigned=current;
    }else assigned=null;
    first=false;
    if(Date.now()>=deadline)return;
    do{
     if(!page.has_more)await delay(intervalMs,undefined,{signal});
     if(signal.aborted||Date.now()>=deadline)return;
     if(!(await ports.subscriptions()).length)return;
     page=await ports.poll(page.next_cursor);
     if(!page.changes.length)yield ': keepalive\n\n';
    }while(!page.changes.length&&!signal.aborted);
   }
  }catch{
   // Never serialize tokens, request arguments, or raw database failures into a stream.
   // A disconnected client reconnects with its last received cursor and reauthenticates.
  }
 }
 return Readable.from(messages());
}
