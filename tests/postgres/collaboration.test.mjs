import {test} from 'node:test';
import assert from 'node:assert/strict';
import {postgresFixture} from '../helpers/postgres.mjs';
import {createPostgresActionStore,cursorScope} from '../../lib/adapters/postgres/action-store.ts';
import {issuePrincipal} from '../../lib/server/node/principal.ts';
import {actionCall} from '../../lib/application/action-service.ts';
import {exportData,importData,transferDigest} from '../../lib/adapters/postgres/transfer.ts';
const proposal={title:'Prepare response',instructions:' Exact raw text\0\ud800 ',scope:'Prepare a draft',outcome:'Draft and evidence',exclusions:'Do not send',source:'Conversation'};
test('real PostgreSQL collaboration contract: competition, replay, adoption, retention, isolation and transfer',async t=>{
 const f=await postgresFixture();t.after(()=>f.close());
 const invoke=(user,connection='client-a')=>{const p=issuePrincipal({user,issuer:'test',subject:user,clientId:'example-client',connectionId:connection,actorKind:'client',scopes:['state:read','state:write']});return (name,args={})=>actionCall({store:createPostgresActionStore(f.pool,p),clock:()=> '2026-10-29T12:00:00.000Z',newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope(user,'example-epoch')},name,args);};
 const call=invoke('A');const write=async(name,args)=>call(name,{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:(await call('list_actions')).revision,...args});
 const created=await write('apply_change',{kind:'add',payload:{title:'Human work'}}),actionId=created.actions[0].id;
 const proposed=await write('propose_collaboration',{action_id:actionId,proposal});const record=proposed.collaborations[0];
 assert.equal(proposed.actions.length,1);assert.equal(record.proposal.instructions,proposal.instructions);
 await t.test('one decision wins, exact duplicate replays, stale version is refused',async()=>{
  const a={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:proposed.revision,id:record.id,command:'accept',payload:{version:1}};
  const both=await Promise.all([call('update_collaboration',a),call('update_collaboration',a)]);assert.equal(both[0].result.revision,both[1].result.revision);assert.equal(both[0].collaborations[0].progress,'not_started');
  await assert.rejects(call('update_collaboration',{...a,payload:{version:2}}),e=>e.code==='idempotency_conflict');
  const revision=(await call('list_actions')).revision;
  const competitors=await Promise.allSettled(['withdraw','request_changes'].map(command=>call('update_collaboration',{...a,operationId:crypto.randomUUID(),expectedRevision:revision,command,payload:{version:1,feedback:'Change the scope'}})));
  assert.equal(competitors.filter(r=>r.status==='fulfilled').length,1);
 });
 await t.test('new work adoption is atomic and survives lost response and receipt pruning',async()=>{
  const newWork=await write('propose_collaboration',{action_id:null,proposal});const key=newWork.result.collaboration_id;
  const request={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:newWork.revision,id:key,command:'adopt',payload:{version:1},action_id:null,delegate:true};
  const first=await call('update_collaboration',request);const replay=await call('update_collaboration',request);assert.equal(first.actions.length,2);assert.deepEqual(replay.result,first.result);
  await write('apply_change',{kind:'edit',payload:{id:actionId,title:'Later correction'}});
  await f.admin.query('DELETE FROM state.operations WHERE user_id=$1 AND operation_id=$2',['A',request.operationId]);
  // Keep a later receipt as the user revision head, just as ordinary prefix pruning does.
  const status=await call('operation_status',{operationId:request.operationId});assert.equal(status.status,'applied');
  assert.equal((await call('update_collaboration',request)).actions.length,2);
  await assert.rejects(write('undo_change',{undoOf:request.operationId}),e=>e.code==='invalid_state');
  await f.admin.query('INSERT INTO state.operations(user_id,operation_id,canonical_payload,result,delta,revision_before,revision_after,undo_of,created_at,client_id,actor_kind) SELECT user_id,operation_id,canonical_payload,result,delta,revision-1,revision,null,$2,$3,$4 FROM state.collaboration_history WHERE user_id=$1 AND operation_id=$5',['A','2026-10-29T12:00:00.000Z','example-client','client',request.operationId]);
 });
 await t.test('run reports are connection-bound and never complete an action',async()=>{
  const rows=(await call('list_actions')).collaborations,key=rows.find(r=>r.decision==='accepted').id;
  const start=await write('update_collaboration',{id:key,command:'start',payload:{version:1}}),run=start.collaborations.find(r=>r.id===key);
  const args={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:start.revision,id:key,command:'report',payload:{version:1,run_id:run.run_id,summary:'Draft complete',remaining:'User must send',outcome:'success',artifacts:[]}};
  await assert.rejects(invoke('A','client-b')('update_collaboration',args),e=>e.code==='conflict');
  const result=await call('update_collaboration',args);assert.equal(result.actions.find(r=>r.id===run.action_id).status,'active');
 });
 await t.test('cross-user reads, writes and direct SQL are isolated',async()=>{
  assert.equal((await invoke('B')('list_collaborations')).collaborations.length,0);
  await assert.rejects(invoke('B')('get_collaboration',{id:record.id}),e=>e.code==='not_found');
  assert.equal((await f.pool.query('SELECT * FROM state.collaborations')).rows.length,0);
  assert.equal((await f.pool.query('SELECT * FROM state.collaboration_history')).rows.length,0);
 });
 await t.test('legacy feed shape remains intact and history preserves original revisions',async()=>{
  const detail=await call('get_collaboration',{id:record.id});assert(detail.history.length>=2);assert.equal(detail.history.at(-1).record.proposal.instructions,proposal.instructions);
  const start=await invoke('C')('get_change_cursor');const c=invoke('C');await c('propose_collaboration',{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:0,action_id:null,proposal});const feed=await c('get_changes',{cursor:start.cursor});assert.deepEqual(Object.keys(feed.changes[0].changes).sort(),['action_tags','actions','perspectives','projects','tags']);
 });
 await t.test('export and import include collaboration heads, history and replay identities',async()=>{
  const target=await postgresFixture();t.after(()=>target.close());const data=await exportData(f.admin);assert(data.tables['state.collaboration_history'].length>0);await importData(target.admin,data,transferDigest(data));assert.deepEqual((await exportData(target.admin)).tables['state.collaborations'],data.tables['state.collaborations']);
 });
});

test('real PostgreSQL enforces the three-proposal cap and exclusive selection under concurrent writes',async t=>{
 const f=await postgresFixture();t.after(()=>f.close());const principal=issuePrincipal({user:'choices',issuer:'test',subject:'choices',clientId:'example-client',connectionId:'connection',actorKind:'client',scopes:['state:read','state:write']});
 const call=(name,args={})=>actionCall({store:createPostgresActionStore(f.pool,principal),clock:()=> '2026-10-29T12:00:00.000Z',newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope(principal.user,'example-epoch')},name,args);
 const write=async(name,args)=>call(name,{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:(await call('list_actions')).revision,...args});
 const action=(await write('apply_change',{kind:'add',payload:{title:'Choose a proposal'}})).actions[0];
 await write('propose_collaboration',{action_id:action.id,proposal});await write('propose_collaboration',{action_id:action.id,proposal});const state=await call('list_actions');
 const racers=await Promise.allSettled([1,2].map(()=>call('propose_collaboration',{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:state.revision,action_id:action.id,proposal})));assert.equal(racers.filter(r=>r.status==='fulfilled').length,1);
 let current=await call('list_actions');assert.equal(current.collaborations.length,3);await assert.rejects(write('propose_collaboration',{action_id:action.id,proposal}),e=>e.code==='conflict');
 const ids=current.collaborations.map(c=>c.id),choices=await Promise.allSettled(ids.slice(0,2).map(id=>call('update_collaboration',{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:current.revision,id,command:'accept',payload:{version:1}})));assert.equal(choices.filter(r=>r.status==='fulfilled').length,1);
 current=await call('list_actions');const accepted=current.collaborations.find(c=>c.decision==='accepted');await write('update_collaboration',{id:accepted.id,command:'withdraw',payload:{version:1}});
 current=await call('list_actions');assert.equal(current.collaborations.length,3);assert.equal(current.collaborations.find(c=>c.id===accepted.id).decision,'pending');
 await write('update_collaboration',{id:ids.find(id=>id!==accepted.id),command:'accept',payload:{version:1}});assert.equal((await call('list_actions')).actions[0].status,'active');
});
