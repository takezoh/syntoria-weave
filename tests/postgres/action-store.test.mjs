import {test} from 'node:test';
import assert from 'node:assert/strict';
import {postgresFixture} from '../helpers/postgres.mjs';
import {createPostgresActionStore,cursorScope,userTransaction} from '../../lib/adapters/postgres/action-store.ts';
import {issuePrincipal} from '../../lib/server/node/principal.ts';
import {actionCall} from '../../lib/application/action-service.ts';
import {checkRuntime} from '../../lib/adapters/postgres/migrations.ts';
const now='2026-10-18T00:00:00.000Z';
test('real PostgreSQL transaction, replay, user, Undo and feed contract',async t=>{
 const f=await postgresFixture();t.after(()=>f.close());
 const identity=user=>issuePrincipal({user,issuer:'test',subject:user,connectionId:`test:${user}`,clientId:'test',scopes:['state:read','state:write']});
 const store=user=>createPostgresActionStore(f.pool,identity(user));
 const call=(user,name,args={})=>actionCall({store:store(user),clock:()=>now,newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope(user,'test-epoch')},name,args);
 const write=async(user,kind,payload)=>call(user,'apply_change',{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:(await call(user,'list_actions')).revision,kind,payload});
 await t.test('runtime does not bypass RLS; empty reads do not create rows',async()=>{
  await checkRuntime(f.pool);assert.equal((await store('A').readSnapshot()).revision,0);
  assert.equal((await f.admin.query('SELECT count(*) FROM state.operations')).rows[0].count,'0');
  assert.equal((await f.pool.query('SELECT count(*) FROM state.actions')).rows[0].count,'0');
 });
 let request,actionId;
 await t.test('simultaneous initial writes have one winner and a duplicate has one receipt',async()=>{
  request={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:0,kind:'add',payload:{title:'原文',notes:'日本語\0\ud800😀'}};
  const result=await Promise.all([call('A','apply_change',request),call('A','apply_change',request)]);
  assert.equal(result[0].result.operationId,result[1].result.operationId);actionId=result[0].result.resolved.actions[0].id;
  assert.equal((await call('A','list_actions')).actions[0].notes,request.payload.notes);
  const competition=await Promise.allSettled([0,1].map(()=>call('B','apply_change',{...request,operationId:crypto.randomUUID()})));
  assert.equal(competition.filter(x=>x.status==='fulfilled').length,1);assert.equal(competition.find(x=>x.status==='rejected').reason.code,'conflict');
 });
 await t.test('replay returns original receipt with a later correction',async()=>{
  await write('A','edit',{id:actionId,title:'Correction'});
  const replay=await call('A','apply_change',request);assert.equal(replay.result.revision,1);assert.equal(replay.revision,2);assert.equal(replay.actions[0].title,'Correction');
  await assert.rejects(call('A','apply_change',{...request,payload:{title:'different'}}),e=>e.code==='idempotency_conflict');
  assert.equal((await call('B','list_actions')).actions[0].title,'原文');
 });
 await t.test('changed canonical input precedes corrupt graph decoding',async()=>{
  await f.admin.query('ALTER DOMAIN state.text_cell DROP CONSTRAINT text_cell_check');
  await f.admin.query('UPDATE state.actions SET notes=$1 WHERE user_id=$2',['invalid-json','A']);
  try{await assert.rejects(call('A','apply_change',{...request,payload:{title:'different'}}),e=>e.code==='idempotency_conflict');}
  finally{await f.admin.query('UPDATE state.actions SET notes=$1 WHERE user_id=$2',[JSON.stringify(request.payload.notes),'A']);}
 });
 await t.test('a deferred FK error rolls back receipt, records and pruning',async()=>{
  await f.admin.query("CREATE FUNCTION state.reject_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.title='\"Reject at commit\"' THEN RAISE EXCEPTION 'test failure' USING ERRCODE='23503'; END IF; RETURN NEW; END $$");
  await f.admin.query('CREATE CONSTRAINT TRIGGER reject_test AFTER UPDATE ON state.actions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION state.reject_test()');
  const before=await store('A').readSnapshot(),after=structuredClone(before);after.actions[0].title='Reject at commit';
  const op=crypto.randomUUID();await assert.rejects(store('A').commit({operationId:op,payload:'{}',before,after,now,undoOf:null}),e=>e.code==='23503');
  assert.equal(await store('A').readReceipt(op),null);assert.equal((await store('A').readSnapshot()).revision,2);
 });
 await t.test('Undo preserves later target corrections and feed has whole committed operations',async()=>{
  const original=await write('A','edit',{id:actionId,title:'Undo me'});await write('A','edit',{id:actionId,title:'Later'});
  await assert.rejects(call('A','undo_change',{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:4,undoOf:original.result.operationId}),e=>e.code==='undo_conflict');
  const latest=await write('A','edit',{id:actionId,title:'Latest'});
  await call('A','undo_change',{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:5,undoOf:latest.result.operationId});
  assert.equal((await store('A').readSnapshot()).actions[0].title,'Later');
  const snapshot=await call('A','list_actions');await write('A','edit',{id:actionId,flagged:true});
  const changes=await call('A','get_changes',{cursor:snapshot.change_cursor});assert.equal(changes.changes.length,1);
  assert.equal(changes.changes[0].revision_after,7);
 });
 await t.test('repeatable reads stay consistent and pooled RLS context is reset',async()=>{
  let release;const hold=new Promise(r=>{release=r;});let pinned;const ready=new Promise(r=>{pinned=r;});
  const read=userTransaction(f.pool,'A',true,async client=>{const first=(await client.query('SELECT max(revision_after) AS revision FROM state.operations WHERE user_id=$1',['A'])).rows[0].revision;pinned();await hold;const last=(await client.query('SELECT max(revision_after) AS revision FROM state.operations WHERE user_id=$1',['A'])).rows[0].revision;return [first,last];});
  await ready;await write('A','edit',{id:actionId,title:'Concurrent'});release();const values=await read;assert.equal(values[0],values[1]);
  for(let i=0;i<8;i++)assert.equal((await f.pool.query('SELECT count(*) FROM state.actions')).rows[0].count,'0');
 });
 await t.test('lost client response resolves by exact replay without applying twice',async()=>{
  const before=await call('A','list_actions');const exact={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:before.revision,kind:'edit',payload:{id:actionId,title:'Lost reply'}};
  let lost=false;const droppingPool={async connect(){const client=await f.pool.connect();let written=false;return new Proxy(client,{get(target,key){if(key==='query')return async(...args)=>{const result=await target.query(...args);if(String(args[0]).startsWith('INSERT INTO state.operations'))written=true;if(args[0]==='COMMIT'&&written&&!lost){lost=true;throw new Error('lost COMMIT response');}return result;};return Reflect.get(target,key);}});}};
  const droppingStore=createPostgresActionStore(droppingPool,identity('A'));
  await assert.rejects(actionCall({store:droppingStore,clock:()=>now,newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope('A','test-epoch')},'apply_change',exact),/lost COMMIT response/);const status=await call('A','operation_status',{operationId:exact.operationId});assert.equal(status.status,'applied');
  const replay=await call('A','apply_change',exact);assert.equal(replay.revision,before.revision+1);
 });
 await t.test('multi-chunk changed-row upserts and deletes preserve all rows and one receipt',async()=>{
  const before=await store('bulk-user').readSnapshot(),template=(await store('B').readSnapshot()).actions[0];
  const after={...before,actions:Array.from({length:205},(_,order)=>({...template,id:crypto.randomUUID(),title:'Bulk '+order,parent_id:null,project_id:null,order,revision:1}))};
  await store('bulk-user').commit({operationId:crypto.randomUUID(),payload:'{}',before,after,now,undoOf:null});
  const saved=await store('bulk-user').readSnapshot();assert.equal(saved.actions.length,205);assert.equal(saved.revision,1);
  await store('bulk-user').commit({operationId:crypto.randomUUID(),payload:'{}',before:saved,after:{...saved,actions:[]},now,undoOf:null});
  const removed=await store('bulk-user').readSnapshot();assert.equal(removed.actions.length,0);assert.equal(removed.revision,2);
 });
 await t.test('retention prunes only the oldest prefix and expires cursors',async()=>{
  const bootstrap=await call('Retention','list_actions');let latest;
  for(let i=0;i<102;i++)latest=await write('Retention','project_get_or_create',{name:'Project '+i});
  const rows=await store('Retention').readChangeWindow(0,null);assert.equal(rows.operations.length,100);assert.equal(rows.oldest_revision,3);assert.equal(rows.head_revision,102);
  await assert.rejects(call('Retention','get_changes',{cursor:bootstrap.change_cursor}),e=>e.code==='cursor_expired');
  assert.equal((await call('Retention','list_actions')).revision,latest.revision);
 });
});
