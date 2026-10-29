import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createD1ActionStore,actionCallForUser as actionCall} from '../helpers/user-composition.mjs';
import {sqliteFixture} from '../helpers/sqlite-d1.mjs';

const now='2026-10-04T00:00:00.000Z';
const uuid='00000000-0000-4000-8000-000000000001';

test('metadata SQLite migration adds current action shape and preserves special text in retained Undo history',async t=>{
 const fixture=sqliteFixture({beforeActionMetadataMigration:true});t.after(()=>fixture.sql.close());
 const {sql}=fixture,notes='original\0note',action={
  id:uuid,title:'Saved action',revision:1,parent_id:null,project_id:null,status:'active',
  due_at:null,defer_until:null,notes,order:0,flagged:false,created_at:now,updated_at:now,
 };
 sql.prepare('INSERT INTO actions(owner,id,title,revision,parent_id,project_id,status,due_at,defer_until,notes,"order",flagged,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  .run('A',action.id,action.title,action.revision,action.parent_id,action.project_id,action.status,action.due_at,action.defer_until,action.notes,action.order,0,action.created_at,action.updated_at);
 const delta={perspectives:[],actions:[{before:null,after:action}],projects:[],tags:[],action_tags:[]};
 sql.prepare('INSERT INTO operations(owner,operation_id,canonical_payload,result,delta,revision_before,revision_after,undo_of,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
  .run('A',uuid,'{}',JSON.stringify({operationId:uuid,revision:1,changedIds:[uuid]}),JSON.stringify(delta),0,1,null,now);

 sql.exec(readFileSync('drizzle/0018_action_metadata.sql','utf8'));
 const store=createD1ActionStore(fixture.db,{userId:'A'}),ports={store,clock:()=>now,newId:()=>crypto.randomUUID()};
 const snapshot=await store.readSnapshot('A');
 assert.equal(snapshot.actions[0].metadata,'');assert.equal(snapshot.actions[0].notes,notes);
 const receipt=await store.readReceipt('A',uuid),savedDelta=JSON.parse(receipt.delta);
 assert.equal(savedDelta.actions[0].after.metadata,'');assert.equal(savedDelta.actions[0].after.notes,notes);
 await actionCall(ports,'A','undo_change',{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:1,undoOf:uuid});
 const undone=await store.readSnapshot('A');
 assert.equal(undone.actions[0].status,'dropped');assert.equal(undone.actions[0].metadata,'');assert.equal(undone.actions[0].notes,notes);
});
