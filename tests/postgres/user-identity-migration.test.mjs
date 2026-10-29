import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {postgresFixture} from '../helpers/postgres.mjs';
import {migrate,checkRuntime,grantRuntime} from '../../lib/adapters/postgres/migrations.ts';
import {createPostgresActionStore,cursorScope,userLockKey} from '../../lib/adapters/postgres/action-store.ts';
import {issuePrincipal} from '../../lib/server/node/principal.ts';
import {actionCall} from '../../lib/application/action-service.ts';
import {exportData} from '../../lib/adapters/postgres/transfer.ts';

test('populated identity migration preserves IDs, receipts, replay and user isolation',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'action-old-schema-'));
 await copyFile('db/postgres/migrations/0001_state.sql',join(directory,'0001_state.sql'));
 const source=await postgresFixture(),target=await postgresFixture({migrations:directory,collaboration:false});
 t.after(async()=>{await source.close();await target.close();await rm(directory,{recursive:true,force:true});});
 const invoke=(pool,user,name,args={})=>actionCall({store:createPostgresActionStore(pool,issuePrincipal({user,issuer:'test',subject:user,connectionId:`test:${user}`,clientId:'test',actorKind:'client',scopes:['state:read','state:write']})),clock:()=> '2026-10-18T00:00:00.000Z',newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope(user,'epoch')},name,args);
 const request={schemaVersion:2,expectedRevision:0,operationId:crypto.randomUUID(),kind:'add',payload:{title:'Preserve 日本語',notes:'exact\0\ud800😀\udfffnotes with "before": {"metadata": false} and \\ quotes'}};
 const created=await invoke(source.pool,'A','apply_change',request),actionId=created.result.resolved.actions[0].id;
 const correction={schemaVersion:2,expectedRevision:1,operationId:crypto.randomUUID(),kind:'edit',payload:{id:actionId,notes:'corrected\0\udfff😀 notes with "after": {"metadata": false} and \\ quotes'}};
 const edited=await invoke(source.pool,'A','apply_change',correction);
 await source.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3)',['test','person','A']);
 const value=await exportData(source.admin),legacyValue=structuredClone(value);
 for(const row of legacyValue.tables['state.actions'])delete row.metadata;
 for(const row of legacyValue.tables['state.operations']){const delta=JSON.parse(row.delta);for(const item of delta.actions)for(const side of ['before','after'])if(item[side])delete item[side].metadata;row.delta=JSON.stringify(delta);}
 const preservedDelta=JSON.parse(legacyValue.tables['state.operations'][0].delta);preservedDelta.actions[0].after.metadata='pre-existing operational metadata';
 legacyValue.tables['state.operations'][0].delta=JSON.stringify(preservedDelta);value.tables['state.operations'][0].delta=JSON.stringify(preservedDelta);
 // Populate the applied schema using its exact column names before the forward migration.
 // Provenance did not exist yet, so migrated operations have an unknown client and actor.
 for(const [table,rows] of Object.entries(legacyValue.tables))for(const row of rows){
  const entries=Object.entries(row).filter(([key])=>!(table==='state.operations'&&(key==='client_id'||key==='actor_kind'))),columns=entries.map(([key])=>'"'+(key==='user_id'?'owner':key)+'"');
  await target.admin.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${entries.map((_,i)=>'$'+(i+1)).join(',')})`,entries.map(([,value])=>value));
 }
 await target.admin.query('INSERT INTO identity.client_grants(issuer,subject,client_id,scopes,enabled) VALUES($1,$2,$3,$4,false)',['test','person','fixed-client',['state:read','state:write']]);
 await assert.rejects(checkRuntime(target.pool),/Incompatible schema/);
 const metadataMigration=await readFile('db/postgres/migrations/0007_action_metadata_text.sql','utf8');
 const limited=await target.pool.connect();
 try{await limited.query('BEGIN');await assert.rejects(limited.query(metadataMigration),/superuser or BYPASSRLS/);await limited.query('ROLLBACK');}
 finally{limited.release();}
 assert.equal((await target.admin.query('SELECT count(*)::int AS count FROM public.schema_migrations WHERE version=$1',['0007_action_metadata_text.sql'])).rows[0].count,0);
 const journal=(await target.admin.query('SELECT version,checksum FROM schema_migrations')).rows;
 await migrate(target.admin,resolve('db/postgres/migrations'));
 await migrate(target.admin,resolve('db/postgres/migrations'));
 await grantRuntime(target.admin,'action_runtime');
 await checkRuntime(target.pool);
 assert.deepEqual((await target.admin.query('SELECT version,checksum FROM schema_migrations WHERE version=$1',['0001_state.sql'])).rows,journal);
 const migrated=structuredClone(value);for(const row of migrated.tables['state.operations']){row.client_id=null;row.actor_kind=null;}
 const actualTransfer=await exportData(target.admin);assert.equal(actualTransfer.version,7);assert.deepEqual(actualTransfer.tables['state.actions'],migrated.tables['state.actions']);
 for(let index=0;index<actualTransfer.tables['state.operations'].length;index++){
  const actual=actualTransfer.tables['state.operations'][index],expected=migrated.tables['state.operations'][index];
  assert.equal(actual.canonical_payload,expected.canonical_payload);assert.equal(actual.result,expected.result);assert.deepEqual(JSON.parse(actual.delta),JSON.parse(expected.delta));
  actual.delta=expected.delta;
 }
 assert.deepEqual(actualTransfer,migrated);
 assert.equal(JSON.parse(actualTransfer.tables['state.operations'][0].delta).actions[0].after.metadata,'pre-existing operational metadata');
 assert.equal((await target.admin.query("SELECT to_regclass('identity.client_grants') AS table_name")).rows[0].table_name,null);
 const saved=await invoke(target.pool,'A','list_actions');assert.deepEqual(saved.actions,edited.actions);
 const replay=await invoke(target.pool,'A','apply_change',request);assert.deepEqual(replay.result,created.result);assert.deepEqual(replay.actions,saved.actions);
 const undone=await invoke(target.pool,'A','undo_change',{schemaVersion:2,operationId:crypto.randomUUID(),expectedRevision:2,undoOf:correction.operationId});assert.equal(undone.actions[0].status,'active');assert.equal(undone.actions[0].notes,request.payload.notes);assert.equal(undone.actions[0].metadata,'');
 assert.equal((await invoke(target.pool,'B','list_actions')).actions.length,0);
 const second=await invoke(target.pool,'B','apply_change',request);assert.equal(second.revision,1);
 assert.equal((await invoke(target.pool,'A','list_actions')).actions[0].id,saved.actions[0].id);
 assert.equal((await target.pool.query('SELECT count(*) FROM state.actions')).rows[0].count,'0');
 assert.equal(userLockKey('A'),createHash('sha256').update('action-tools/owner-commit/v1\0A').digest().readBigInt64BE(0).toString());
 assert.equal((await target.admin.query('SELECT user_id FROM identity.subjects')).rows[0].user_id,'A');
});
