import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createD1ActionStore} from '../../lib/adapters/d1-action-store.ts';
import {change} from '../../lib/domain/core.ts';
import {sqliteFixture} from '../helpers/sqlite-d1.mjs';

const now = '2026-10-03T00:00:00.000Z';

test('explicit D1 adapter scopes fix users and isolate the same entity ID', async t => {
  const f = sqliteFixture(); t.after(() => f.sql.close());
  const a = createD1ActionStore(f.db, {userId:'A'}), b = createD1ActionStore(f.db, {userId:'B'});
  const id = crypto.randomUUID();
  const beforeA = await a.readSnapshot();
  await a.commit({operationId: crypto.randomUUID(), payload: 'A', before: beforeA, after: change(beforeA, {kind: 'add', payload: {id, title: 'A only'}}, now), now, undoOf: null});
  assert.equal((await a.readSnapshot()).actions.length, 1);
  assert.equal((await b.readSnapshot()).actions.length, 0);
  const beforeB = await b.readSnapshot();
  await b.commit({operationId: crypto.randomUUID(), payload: 'B', before: beforeB, after: change(beforeB, {kind: 'add', payload: {id, title: 'B only'}}, now), now, undoOf: null});
  assert.equal((await b.readSnapshot()).actions[0].title, 'B only');
  assert.equal((await a.readSnapshot()).actions[0].title, 'A only');
});

test('a generated commit plan over the storage budget is rejected before writing', async t => {
  const f = sqliteFixture(); t.after(() => f.sql.close());
  const store = createD1ActionStore(f.db, {userId:'A'});
  const before = await store.readSnapshot();
  let after = before;
  for (let index = 0; index < 6; index++) after = change(after, {kind: 'add', payload: {id: crypto.randomUUID(), title: 'parent ' + index, notes: 'x'.repeat(65536)}}, now);
  await assert.rejects(store.commit({operationId: crypto.randomUUID(), payload: 'plan', before, after, now, undoOf: null}), e => e.code === 'operation_too_large');
  const unchanged = await store.readSnapshot();
  assert.equal(unchanged.revision, 0);
  assert.equal(unchanged.actions.length, 0);
});

test('D1 adapter rejects malformed scopes and ignores commit user overrides', async t => {
 const f=sqliteFixture();t.after(()=>f.sql.close());
 for(const forged of [null,'A',{}, {userId:''},{userId:' A'},{userId:'A '.repeat(257)}])assert.throws(()=>createD1ActionStore(f.db,forged),e=>e.code==='unauthenticated');
 const a=createD1ActionStore(f.db,{userId:'A'}),b=createD1ActionStore(f.db,{userId:'B'}),before=await a.readSnapshot();
 await a.commit({user:'B',operationId:crypto.randomUUID(),payload:'override',before,after:change(before,{kind:'add',payload:{id:crypto.randomUUID(),title:'A remains bound'}},now),now,undoOf:null});
 assert.equal((await a.readSnapshot()).actions.length,1);assert.equal((await b.readSnapshot()).actions.length,0);
});
