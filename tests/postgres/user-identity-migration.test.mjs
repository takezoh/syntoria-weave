import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {postgresFixture} from '../helpers/postgres.mjs';
import {migrate,checkRuntime} from '../../lib/adapters/postgres/migrations.ts';
import {createPostgresActionStore,cursorScope,userLockKey} from '../../lib/adapters/postgres/action-store.ts';
import {issuePrincipal} from '../../lib/server/node/principal.ts';
import {actionCall} from '../../lib/application/action-service.ts';
import {exportData} from '../../lib/adapters/postgres/transfer.ts';

test('populated identity migration preserves IDs, receipts, replay and user isolation',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'action-old-schema-'));
 await copyFile('db/postgres/migrations/0001_state.sql',join(directory,'0001_state.sql'));
 const source=await postgresFixture(),target=await postgresFixture({migrations:directory});
 t.after(async()=>{await source.close();await target.close();await rm(directory,{recursive:true,force:true});});
 const invoke=(pool,user,name,args={})=>actionCall({store:createPostgresActionStore(pool,issuePrincipal({user,issuer:'test',subject:user,clientId:'test',scopes:['state:read','state:write']})),clock:()=> '2026-10-18T00:00:00.000Z',newId:()=>crypto.randomUUID(),changeCursorScope:async()=>cursorScope(user,'epoch')},name,args);
 const request={schemaVersion:2,expectedRevision:0,operationId:crypto.randomUUID(),kind:'add',payload:{title:'Preserve 日本語',notes:'exact\0notes'}};
 const original=await invoke(source.pool,'A','apply_change',request);
 await source.admin.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3)',['test','person','A']);
 const value=await exportData(source.admin);
 // Populate the applied schema using its exact column names before the forward migration.
 for(const [table,rows] of Object.entries(value.tables))for(const row of rows){
  const entries=Object.entries(row),columns=entries.map(([key])=>'"'+(key==='user_id'?'owner':key)+'"');
  await target.admin.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${entries.map((_,i)=>'$'+(i+1)).join(',')})`,entries.map(([,value])=>value));
 }
 await assert.rejects(checkRuntime(target.pool),/Incompatible schema/);
 const journal=(await target.admin.query('SELECT version,checksum FROM schema_migrations')).rows;
 await migrate(target.admin,resolve('db/postgres/migrations'));
 await migrate(target.admin,resolve('db/postgres/migrations'));
 await checkRuntime(target.pool);
 assert.deepEqual((await target.admin.query('SELECT version,checksum FROM schema_migrations WHERE version=$1',['0001_state.sql'])).rows,journal);
 assert.deepEqual(await exportData(target.admin),value);
 const saved=await invoke(target.pool,'A','list_actions');assert.deepEqual(saved.actions,original.actions);
 const replay=await invoke(target.pool,'A','apply_change',request);assert.deepEqual(replay.result,original.result);
 assert.equal((await invoke(target.pool,'B','list_actions')).actions.length,0);
 const second=await invoke(target.pool,'B','apply_change',request);assert.equal(second.revision,1);
 assert.equal((await invoke(target.pool,'A','list_actions')).actions[0].id,saved.actions[0].id);
 assert.equal((await target.pool.query('SELECT count(*) FROM state.actions')).rows[0].count,'0');
 assert.equal(userLockKey('A'),createHash('sha256').update('action-tools/owner-commit/v1\0A').digest().readBigInt64BE(0).toString());
 assert.equal((await target.admin.query('SELECT user_id FROM identity.subjects')).rows[0].user_id,'A');
});
