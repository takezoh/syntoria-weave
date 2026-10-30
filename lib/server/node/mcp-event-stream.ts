import {Readable} from 'node:stream';
import {setTimeout as delay} from 'node:timers/promises';
import {ASSIGNED_RESOURCE_URI,STATE_RESOURCE_URI,assignedUpdated,stateUpdated} from '../../mcp/state-resource';
import {SERVER_INFO,SERVER_INFO_KEY,SUBSCRIPTION_ID_KEY,type RequestId} from '../../mcp/protocol';
import type {ChangePage} from '../../data/model/change-cursor';

export type EventStreamPorts={
 poll(cursor:string):Promise<ChangePage>;
 /** The resources this connection currently subscribes to; empty ends the stream. */
 subscriptions():Promise<readonly string[]>;
 /** A comparable value of this connection's assigned content; called only while that resource is subscribed. */
 assigned():Promise<string>;
};
/** Legacy GET streams carry resumable cursor IDs; subscriptions/listen streams carry their request ID instead. */
export type EventStreamFraming=Readonly<{kind:'legacy'}|{kind:'listen';id:RequestId;resources:readonly string[]}>;
/** Bounded live transport; durable cursors and receipts, not this process, own recovery. */
export function mcpEventStream(initial:ChangePage,ports:EventStreamPorts,{signal,framing={kind:'legacy'},onError=()=>{},intervalMs=2000,lifetimeMs=25000}:{signal:AbortSignal;framing?:EventStreamFraming;onError?:(error:unknown)=>void;intervalMs?:number;lifetimeMs?:number}){
 async function* messages(){
  let page=initial,assigned:string|null=null;const deadline=Date.now()+lifetimeMs;
  const listen=framing.kind==='listen'?framing:null,meta=listen?{[SUBSCRIPTION_ID_KEY]:listen.id}:{};
  const frame=(data:unknown)=>`${listen?'':`id: ${page.next_cursor}\n`}event: message\ndata: ${JSON.stringify(data)}\n\n`;
  try{
   if(listen){
    yield frame({jsonrpc:'2.0',method:'notifications/subscriptions/acknowledged',params:{_meta:meta,notifications:listen.resources.length?{resourceSubscriptions:listen.resources}:{}}});
    // Nothing supported was requested: end the subscription with its completion result instead of idling.
    if(!listen.resources.length){yield frame({jsonrpc:'2.0',id:listen.id,result:{resultType:'complete',_meta:{...meta,[SERVER_INFO_KEY]:SERVER_INFO}}});return;}
   }else yield 'retry: 2000\n\n';
   // Every connection starts with a refresh hint for each subscribed resource, including an idle/reconnected stream.
   let first=true;
   while(!signal.aborted){
    const resources=await ports.subscriptions();if(!resources.length)return;
    if(resources.includes(STATE_RESOURCE_URI))yield frame(stateUpdated(page.next_cursor,page.through_revision,meta));
    if(resources.includes(ASSIGNED_RESOURCE_URI)){
     // The assigned resource changes only for this connection's work, so compare its content, not the revision.
     const current=await ports.assigned();
     if(first||current!==assigned)yield frame(assignedUpdated(page.through_revision,meta));
     assigned=current;
    }else assigned=null;
    first=false;
    // The lifetime bound ends the stream like a transport timeout, without a completion result, so clients reconnect.
    if(Date.now()>=deadline)return;
    do{
     if(!page.has_more)await delay(intervalMs,undefined,{signal});
     if(signal.aborted||Date.now()>=deadline)return;
     if(!(await ports.subscriptions()).length)return;
     page=await ports.poll(page.next_cursor);
     if(!page.changes.length)yield ': keepalive\n\n';
    }while(!page.changes.length&&!signal.aborted);
   }
  }catch(error){
   // Never serialize tokens, request arguments, or raw database failures into a stream.
   // A disconnected client reconnects and reauthenticates; only failures other than disconnection are reported.
   if(!signal.aborted)onError(error);
  }
 }
 return Readable.from(messages());
}
