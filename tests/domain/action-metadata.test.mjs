import {test} from 'node:test';
import assert from 'node:assert/strict';
import {change} from '../../lib/domain/core.ts';
import {delta,undo} from '../../lib/domain/operations.ts';

const now='2026-10-04T00:00:00.000Z';
const id='00000000-0000-4000-8000-000000000001';
const empty=()=>({revision:0,catalog_identity_ledger:[],actions:[],projects:[],tags:[],action_tags:[],perspectives:[]});

test('Action metadata is separate exact text, defaults empty, preserves on omission and clears explicitly',()=>{
 const source=empty(),notes='  Human input\0\ud800😀  ',metadata='  caller operations\n\udfff  ';
 const created=change(source,{kind:'add',payload:{id,title:'Capture',notes,metadata}},now);
 assert.equal(created.actions[0].notes,notes);assert.equal(created.actions[0].metadata,metadata);
 assert.deepEqual(source,empty());
 const notesEdit=change(created,{kind:'edit',payload:{id,notes:'human correction'}},'2026-10-05T00:00:00.000Z');
 assert.equal(notesEdit.actions[0].notes,'human correction');assert.equal(notesEdit.actions[0].metadata,metadata);
 const cleared=change(notesEdit,{kind:'edit',payload:{id,metadata:''}},'2026-10-06T00:00:00.000Z');
 assert.equal(cleared.actions[0].notes,'human correction');assert.equal(cleared.actions[0].metadata,'');
 const changes=delta(notesEdit,cleared);
 assert.equal(changes.actions[0].before.metadata,metadata);assert.equal(changes.actions[0].after.metadata,'');
 const restored=undo(cleared,changes,'2026-10-07T00:00:00.000Z',cleared.revision);
 assert.equal(restored.actions[0].notes,'human correction');assert.equal(restored.actions[0].metadata,metadata);
 assert.equal(change(empty(),{kind:'add',payload:{id,title:'Default'}},now).actions[0].metadata,'');
});

test('Action metadata validation rejects non-text and over-limit values without changing input',()=>{
 const source=change(empty(),{kind:'add',payload:{id,title:'Saved',metadata:'kept'}},now),before=structuredClone(source);
 for(const metadata of [null,12,'x'.repeat(65537)]){
  assert.throws(()=>change(source,{kind:'edit',payload:{id,metadata}},now),error=>error.code==='invalid_input');
  assert.deepEqual(source,before);
 }
});
