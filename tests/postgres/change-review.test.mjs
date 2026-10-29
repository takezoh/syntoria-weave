import {test} from 'node:test';
import assert from 'node:assert/strict';
import {postgresFixture} from '../helpers/postgres.mjs';
import {createPostgresActionStore,cursorScope} from '../../lib/adapters/postgres/action-store.ts';
import {issuePrincipal} from '../../lib/server/node/principal.ts';
import {actionCall} from '../../lib/application/action-service.ts';
const now='2026-10-29T09:00:00.000Z';

test('real PostgreSQL change review: provenance, summaries, client names and recent history',async t=>{
 const f=await postgresFixture();t.after(()=>f.close());
 // A bearer connection is a client acting for the user; a browser session is the person in the dedicated app.
 const principal=(user,{kind='client',client=`client-${user}`,name=null}={})=>issuePrincipal({user,issuer:'test',subject:user,connectionId:`connection:${user}:${client}`,clientId:client,actorKind:kind,clientName:name,scopes:['state:read','state:write']});
 const ports=(identity,clock=()=>now)=>({store:createPostgresActionStore(f.pool,identity),clock,newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope(identity.user,'test-epoch')});
 const call=(identity,name,args={})=>actionCall(ports(identity),name,args);
 const write=async(identity,kind,payload,extra={})=>call(identity,'apply_change',{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:(await call(identity,'list_actions')).revision,kind,payload,...extra});
 const ai=principal('A',{name:'ChatGPT'}),person=principal('A',{kind:'user',client:'app-browser'}),agent=principal('A',{client:'agent-A',name:'Daily review agent'});

 let parentId,childId;
 await t.test('created_by and updated_by follow the verified committer, including cascades and Undo',async()=>{
  const created=await write(ai,'structure_create',{inbox_action_id:(await write(ai,'add',{title:'Trip'},{summary:'Saved the trip from your message.'})).result.resolved.actions[0].id,actions:[{ref:'parent',title:'Trip'},{ref:'child',title:'Pack',parent_ref:'parent'}]});
  const ids=Object.fromEntries(created.result.resolved.actions.map(row=>[row.ref,row.id]));parentId=ids.parent;childId=ids.child;
  let listed=await call(person,'list_actions');
  const byId=id=>listed.actions.find(row=>row.id===id);
  assert.deepEqual(byId(parentId).created_by,{kind:'client',client_id:'client-A',client_name:'ChatGPT'});
  assert.deepEqual(byId(childId).updated_by,{kind:'client',client_id:'client-A',client_name:'ChatGPT'});
  const completed=await write(person,'complete',{id:parentId});
  listed=await call(person,'list_actions');
  for(const id of [parentId,childId]){assert.deepEqual(byId(id).created_by.client_id,'client-A');assert.deepEqual(byId(id).updated_by,{kind:'user',client_id:'app-browser',client_name:null});}
  await call(agent,'undo_change',{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:listed.revision,undoOf:completed.result.operationId});
  listed=await call(person,'list_actions');
  assert.equal(byId(parentId).status,'active');
  assert.deepEqual(byId(childId).updated_by,{kind:'client',client_id:'agent-A',client_name:'Daily review agent'});
  assert.equal(byId(childId).created_by.client_name,'ChatGPT');
  // Provenance is display data: it never enters persisted rows of the change feed.
  const latest=(await call(person,'list_recent_changes',{limit:1})).changes[0];
  assert(latest.changes.actions.length>0);
  for(const row of latest.changes.actions)for(const side of [row.before,row.after])assert.equal(Object.hasOwn(side,'created_by')||Object.hasOwn(side,'updated_by'),false);
  const columns=(await f.admin.query("SELECT created_by_kind,created_by_client_id,updated_by_kind,updated_by_client_id FROM state.actions WHERE user_id='A' AND id=$1",[childId])).rows[0];
  assert.deepEqual(columns,{created_by_kind:'client',created_by_client_id:'client-A',updated_by_kind:'client',updated_by_client_id:'agent-A'});
 });

 await t.test('summaries are part of request identity, replay exactly and survive unknown outcomes',async()=>{
  const before=await call(ai,'list_actions'),request={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:before.revision,kind:'edit',payload:{id:childId,flagged:true},summary:' Flagged packing because the trip is next week. '};
  const [first,second]=await Promise.all([call(ai,'apply_change',request),call(ai,'apply_change',request)]);
  assert.equal(first.result.operationId,second.result.operationId);assert.equal(first.result.revision,before.revision+1);
  await assert.rejects(call(ai,'apply_change',{...request,summary:'A different description'}),e=>e.code==='idempotency_conflict');
  await assert.rejects(call(ai,'apply_change',{...request,operationId:crypto.randomUUID(),expectedRevision:first.revision,summary:'   '}),e=>e.code==='invalid_input');
  await assert.rejects(call(ai,'apply_change',{...request,operationId:crypto.randomUUID(),expectedRevision:first.revision,summary:'x'.repeat(501)}),e=>e.code==='invalid_input');
  const stored=(await f.admin.query("SELECT summary FROM state.operations WHERE user_id='A' AND operation_id=$1",[request.operationId])).rows[0].summary;
  assert.equal(JSON.parse(stored),request.summary);
  // A lost commit response keeps the receipt; the exact retry returns it without a second write.
  const lostRequest={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:first.revision,kind:'edit',payload:{id:childId,title:'Pack bags'},summary:'Renamed for clarity.'};
  let lost=false;const droppingPool={async connect(){const client=await f.pool.connect();let written=false;return new Proxy(client,{get(target,key){if(key==='query')return async(...args)=>{const result=await target.query(...args);if(String(args[0]).startsWith('INSERT INTO state.operations'))written=true;if(args[0]==='COMMIT'&&written&&!lost){lost=true;throw new Error('lost COMMIT response');}return result;};return Reflect.get(target,key);}});}};
  await assert.rejects(actionCall({...ports(ai),store:createPostgresActionStore(droppingPool,ai)},'apply_change',lostRequest),/lost COMMIT response/);
  const replay=await call(ai,'apply_change',lostRequest);assert.equal(replay.revision,first.revision+1);
  const recent=await call(ai,'list_recent_changes',{limit:2});
  assert.deepEqual(recent.changes.map(row=>row.summary),['Renamed for clarity.',request.summary]);
  assert.deepEqual(recent.changes.map(row=>row.client_name),['ChatGPT','ChatGPT']);
 });

 await t.test('recent history pages newest first with advisory Undo availability',async()=>{
  const head=(await call(person,'list_actions')).revision;
  const page=await call(person,'list_recent_changes',{limit:3});
  assert.deepEqual(page.changes.map(row=>row.revision_after),[head,head-1,head-2]);
  assert.equal(page.head_revision,head);assert.equal(page.next_before_revision,head-2);
  const older=await call(person,'list_recent_changes',{before_revision:page.next_before_revision,limit:50});
  assert.equal(older.changes[0].revision_after,head-3);assert.equal(older.changes.at(-1).revision_after,1);assert.equal(older.next_before_revision,null);
  const all=[...page.changes,...older.changes],byRevision=revision=>all.find(row=>row.revision_after===revision);
  // The rename is the latest change to the child, so undoing it is available.
  assert.equal(byRevision(head).undo.status,'available');
  // The flag edit is followed by the rename of the same Action, so Undo would erase that later correction.
  assert.equal(byRevision(head-1).undo.status,'conflict');
  const undoRow=all.find(row=>row.undo_of!==null),undone=all.find(row=>row.operation_id===undoRow.undo_of);
  assert.equal(undoRow.undo.status,'not_undoable');assert.equal(undone.undo.status,'undone');assert.equal(undone.undone_by,undoRow.operation_id);
  assert.equal(undoRow.actor_kind,'client');assert.equal(undoRow.client_name,'Daily review agent');
  assert.equal(all.find(row=>row.actor_kind==='user').client_name,null);
  const undoLatest=await call(person,'undo_change',{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:head,undoOf:byRevision(head).operation_id});
  assert.equal(undoLatest.revision,head+1);
  assert.equal((await call(person,'list_recent_changes',{before_revision:head+1,limit:1})).changes[0].undo.status,'undone');
  await assert.rejects(call(person,'list_recent_changes',{limit:51}),e=>e.code==='invalid_input');
  await assert.rejects(call(person,'list_recent_changes',{before_revision:0}),e=>e.code==='invalid_input');
  await assert.rejects(call(person,'list_recent_changes',{cursor:'x'}),e=>e.code==='invalid_input');
 });

 await t.test('client names are user-scoped display data written only by client writes',async()=>{
  const namesBefore=(await f.admin.query('SELECT count(*)::int AS n FROM state.client_names')).rows[0].n;
  await call(principal('B',{client:'client-A',name:'Other name'}),'list_actions');
  await call(principal('B',{client:'client-A',name:'Other name'}),'list_recent_changes');
  assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM state.client_names')).rows[0].n,namesBefore);
  const otherUser=principal('B',{client:'client-A',name:'Other name'});
  await write(otherUser,'add',{title:'B action'});
  const rows=(await f.admin.query("SELECT user_id,client_id,name FROM state.client_names WHERE client_id='client-A' ORDER BY user_id")).rows;
  assert.deepEqual(rows.map(row=>[row.user_id,JSON.parse(row.name)]),[['A','ChatGPT'],['B','Other name']]);
  assert.equal((await call(ai,'list_actions')).actions.every(row=>row.created_by?.client_name!=='Other name'),true);
  assert.deepEqual((await call(otherUser,'list_recent_changes')).changes.map(row=>row.client_name),['Other name']);
  // A later reported name replaces the display name for that connection only.
  await write(principal('A',{name:'ChatGPT Desktop'}),'add',{title:'Renamed client'});
  assert.equal(JSON.parse((await f.admin.query("SELECT name FROM state.client_names WHERE user_id='A' AND client_id='client-A'")).rows[0].name),'ChatGPT Desktop');
  // A browser session never records a client name, and a client without a valid name leaves the existing one.
  await write(principal('A',{kind:'user',client:'app-browser',name:'Ignored'}),'add',{title:'From the app'});
  await write(principal('A',{name:' padded '}),'add',{title:'Invalid name'});
  assert.deepEqual((await f.admin.query("SELECT client_id FROM state.client_names WHERE user_id='A' ORDER BY client_id")).rows.map(row=>row.client_id),['agent-A','client-A']);
  assert.equal(JSON.parse((await f.admin.query("SELECT name FROM state.client_names WHERE user_id='A' AND client_id='client-A'")).rows[0].name),'ChatGPT Desktop');
 });
});
