import {test} from 'node:test';
import assert from 'node:assert/strict';
import {postgresFixture} from '../helpers/postgres.mjs';
import {exportData,importData,transferDigest} from '../../lib/adapters/postgres/transfer.ts';
import {grantExport} from '../../lib/adapters/postgres/migrations.ts';
import {createPostgresActionStore,cursorScope} from '../../lib/adapters/postgres/action-store.ts';
import {issuePrincipal} from '../../lib/server/node/principal.ts';
import {actionCall} from '../../lib/application/action-service.ts';
test('real PostgreSQL transfer preserves data and rejects partial or conflicting imports',async t=>{
 const source=await postgresFixture(),target=await postgresFixture();t.after(async()=>{await source.close();await target.close();});
 const principal=issuePrincipal({user:'opaque-user',issuer:'test',subject:'person',connectionId:'test:opaque-user',clientId:'test',actorKind:'client',scopes:['state:read','state:write']});
 const invoke=(pool,name,args={})=>actionCall({store:createPostgresActionStore(pool,principal),clock:()=>new Date().toISOString(),newId:()=>crypto.randomUUID().toUpperCase(),changeCursorScope:async()=>cursorScope(principal.user,'epoch')},name,args);
 const request={schemaVersion:2,expectedRevision:0,operationId:crypto.randomUUID(),kind:'add',payload:{title:'Mixed case ID',notes:'human\0\ud800😀',metadata:'caller\0\udfff😀'}};
 const created=await invoke(source.pool,'apply_change',request);
 const value=await exportData(source.admin),digest=transferDigest(value);
 assert.equal(value.version,7);assert.equal(JSON.parse(value.tables['state.actions'][0].metadata),request.payload.metadata);assert.equal(value.tables['state.operations'][0].client_id,'test');assert.equal(value.tables['state.operations'][0].actor_kind,'client');assert.equal(Object.hasOwn(value.tables,'identity.client_grants'),false);assert.equal(value.tables['state.actions'][0].user_id,principal.user);assert(!('owner' in value.tables['state.actions'][0]));
 await t.test('a corrupt digest or invalid graph imports nothing',async()=>{
  await assert.rejects(importData(target.admin,value,'invalid'),/digest/);
  for(const version of [4,5,6]){const unsupported={...value,version};await assert.rejects(importData(target.admin,unsupported,transferDigest(unsupported)),/manifest/);}
  const invalid=structuredClone(value);invalid.tables['state.actions'][0].title=JSON.stringify('');
  await assert.rejects(importData(target.admin,invalid,transferDigest(invalid)));
  assert.equal((await exportData(target.admin)).tables['state.actions'].length,0);
 });
 await t.test('decoded state, exact receipt and Unicode round trip through import',async()=>{
  await importData(target.admin,value,digest);
  const actual=await invoke(target.pool,'list_actions');assert.deepEqual(actual.actions,created.actions);assert.equal(actual.revision,created.revision);
  const replay=await invoke(target.pool,'apply_change',request);assert.equal(replay.result.operationId,created.result.operationId);assert.deepEqual((await exportData(target.admin)).tables['state.operations'],value.tables['state.operations']);assert.equal(replay.result.resolved.actions[0].id,created.result.resolved.actions[0].id);
  await assert.rejects(importData(target.admin,value,digest),/not empty/);
 });
 await t.test('runtime cannot export all users or assume the export role',async()=>{
  await grantExport(source.admin,'action_export');
  await assert.rejects(exportData(source.pool),/administrative/);
  await assert.rejects(source.pool.query('SET ROLE action_export'),e=>e.code==='42501');
  assert.notEqual(cursorScope(principal.user,'epoch-before'),cursorScope(principal.user,'epoch-after'));
 });
});
