import {Readable} from 'node:stream';
import {setTimeout as delay} from 'node:timers/promises';
import {stateUpdated} from '../../mcp/state-resource';
import type {ChangePage} from '../../data/model/change-cursor';

export type EventStreamPorts={
 poll(cursor:string):Promise<ChangePage>;
 authorized():Promise<boolean>;
};
/** Bounded live transport; durable cursors and receipts, not this process, own recovery. */
export function mcpEventStream(initial:ChangePage,ports:EventStreamPorts,{signal,intervalMs=2000,lifetimeMs=25000}:{signal:AbortSignal;intervalMs?:number;lifetimeMs?:number}){
 async function* messages(){
  let page=initial;const deadline=Date.now()+lifetimeMs;
  try{
   yield 'retry: 2000\n\n';
   // Every connection starts with a refresh hint, including an idle/reconnected stream.
   while(!signal.aborted){
    if(!await ports.authorized())return;
    yield `id: ${page.next_cursor}\nevent: message\ndata: ${JSON.stringify(stateUpdated(page.next_cursor,page.through_revision))}\n\n`;
    if(Date.now()>=deadline)return;
    do{
     if(!page.has_more)await delay(intervalMs,undefined,{signal});
     if(signal.aborted||Date.now()>=deadline)return;
     if(!await ports.authorized())return;
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
