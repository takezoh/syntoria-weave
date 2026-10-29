import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryActionStore} from '../helpers/memory-action-store.mjs';
import {actionCallForUser} from '../helpers/user-composition.mjs';

const now='2026-10-29T09:00:00.000Z';
function service(store=memoryActionStore()){
 let sequence=0;const ports={store,clock:()=>now,newId:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`};
 const call=(user,name,args={})=>actionCallForUser(ports,user,name,args);
 const write=async(user,kind,payload,extra={})=>call(user,'apply_change',{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:(await call(user,'list_actions')).revision,kind,payload,...extra});
 return {store,call,write};
}

test('summaries travel with the operation; recent history reads newest first with advisory Undo status',async()=>{
 const {call,write}=service();
 const added=await write('A','add',{title:'Trip'},{summary:'Saved the trip from your message.'});const id=added.result.resolved.actions[0].id;
 const flagged=await write('A','edit',{id,flagged:true});
 const renamed=await write('A','edit',{id,title:'Trip to Kyoto'},{summary:'Renamed for clarity.'});
 await call('A','undo_change',{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:renamed.revision,undoOf:renamed.result.operationId});
 const page=await call('A','list_recent_changes',{limit:10});
 assert.deepEqual(page.changes.map(row=>row.revision_after),[4,3,2,1]);
 assert.deepEqual(page.changes.map(row=>row.summary),[null,'Renamed for clarity.',null,'Saved the trip from your message.']);
 // The flag edit was followed by a rename and its Undo; the Action revision moved on, so Undo would be refused.
 assert.deepEqual(page.changes.map(row=>row.undo.status),['not_undoable','undone','conflict','conflict']);
 await assert.rejects(call('A','undo_change',{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:4,undoOf:flagged.result.operationId}),error=>error.code==='undo_conflict');
 assert.equal(page.changes[1].undone_by,page.changes[0].operation_id);
 assert.equal(page.changes[2].operation_id,flagged.result.operationId);
 assert.equal(page.next_before_revision,null);
 const older=await call('A','list_recent_changes',{before_revision:3,limit:1});
 assert.deepEqual([older.changes.map(row=>row.revision_after),older.next_before_revision],[[2],2]);
 assert.deepEqual((await call('B','list_recent_changes')).changes,[],'another user sees none of these operations');
 const fresh=await write('A','edit',{id,notes:'Pack light'});
 assert.equal((await call('A','list_recent_changes',{limit:1})).changes[0].undo.status,'available');assert.equal(fresh.revision,5);
 await assert.rejects(write('A','edit',{id,notes:'x'},{summary:'   '}),error=>error.code==='invalid_input');
 await assert.rejects(call('A','list_recent_changes',{limit:0}),error=>error.code==='invalid_input');
});

test('a store without recent history reports it unavailable instead of an empty feed',async()=>{
 const memory=memoryActionStore(),{readRecentChanges,...withoutRecent}=memory;
 assert.equal(typeof readRecentChanges,'function');
 const {call}=service(withoutRecent);
 await assert.rejects(call('A','list_recent_changes'),error=>error.code==='unavailable'&&error.status===503);
});
