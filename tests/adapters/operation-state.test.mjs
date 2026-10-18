import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actionCallForUser as actionCall} from '../helpers/user-composition.mjs';
import {createD1ActionStore} from '../helpers/user-composition.mjs';
import {sqliteFixture} from '../helpers/sqlite-d1.mjs';

const now='2026-10-15T00:00:00.000Z';

function observedDatabase(fixture) {
 const batches=[];
 const db={
  prepare:query=>fixture.db.prepare(query),
  async batch(statements){batches.push(statements.map(statement=>({text:statement.text,values:statement.v})));return fixture.db.batch(statements);}
 };
 return {db,batches};
}

test('ordinary D1 write and identical replay acquire receipt and user snapshot in one batch',async t=>{
 const fixture=sqliteFixture();t.after(()=>fixture.sql.close());
 const {db,batches}=observedDatabase(fixture),store=createD1ActionStore(db);let generated=0;
 const ports={store,clock:()=>now,newId:()=>{generated++;return crypto.randomUUID();}},call=(name,args)=>actionCall(ports,'A',name,args);
 const request={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:0,kind:'add',payload:{title:'Original'}};

 const written=await call('apply_change',request);
 assert.equal(written.revision,1);assert.equal(batches.length,3);
 assert.equal(batches[0].length,8);
 assert.ok(batches[0].every(({text,values})=>text.startsWith('SELECT')&&text.includes('WHERE owner=?')&&values[0]==='A'));
 assert.equal(batches[0][0].values[1],request.operationId);
 assert.equal(batches[1][0].text.startsWith('INSERT INTO operations'),true);
 assert.equal(batches[2].length,7);
 assert.equal(generated,1);

 await call('apply_change',{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:1,kind:'edit',payload:{id:written.result.resolved.actions[0].id,title:'Later correction'}});
 batches.length=0;
 const replay=await call('apply_change',request);
 assert.equal(batches.length,1);assert.equal(batches[0].length,8);
 assert.equal(replay.result.revision,1);assert.equal(replay.revision,2);assert.equal(replay.actions[0].title,'Later correction');
 assert.equal(generated,1);
});

test('D1 replay reports receipt mismatch before decoding a corrupt captured snapshot',async t=>{
 const fixture=sqliteFixture();t.after(()=>fixture.sql.close());
 const store=createD1ActionStore(fixture.db),ports={store,clock:()=>now,newId:()=>crypto.randomUUID()},
  call=(name,args)=>actionCall(ports,'A',name,args),request={schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:0,kind:'add',payload:{title:'Original'}};
 await call('apply_change',request);
 fixture.sql.prepare('UPDATE actions SET title=? WHERE owner=?').run('','A');

 await assert.rejects(call('apply_change',{...request,payload:{title:'Different'}}),error=>error.code==='idempotency_conflict');
 await assert.rejects(call('apply_change',request),error=>error.code==='invalid_input');
 assert.equal((await store.readSnapshot('A')).revision,1);
 assert.equal((await store.readSnapshot('A')).actions[0].title,'');
});
