import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,copyFile,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import pg from 'pg';
import {postgresFixture} from '../helpers/postgres.mjs';
import {migrate} from '../../lib/adapters/postgres/migrations.ts';

const migrations=resolve('db/postgres/migrations');
test('application scope migration supports fresh and historical databases without privileged migration roles',async t=>{
 const f=await postgresFixture();t.after(()=>f.close());
 const url=new URL(f.url),password=decodeURIComponent(url.password);
 await f.admin.query(`CREATE ROLE migration_owner LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
 const directory=await mkdtemp(join(tmpdir(),'action-historical-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 for(const file of await readdir(migrations))if(file!=='0007_action_metadata_text.sql'&&file!=='0009_application_user_scope.sql')await copyFile(join(migrations,file),join(directory,file));
 for(const mode of ['fresh','pending_metadata','applied_metadata'])await t.test(mode,async()=>{
  const database='migration_'+mode;await f.admin.query(`CREATE DATABASE ${database} OWNER migration_owner`);
  url.username='migration_owner';url.pathname='/'+database;
  const pool=new pg.Pool({connectionString:url.href,max:1});
  const adminUrl=new URL(url);adminUrl.username='postgres';const admin=new pg.Pool({connectionString:adminUrl.href,max:1});
  try{
   const role=(await pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.deepEqual(role,{rolsuper:false,rolbypassrls:false});
   const notes='exact\0\ud800😀 and "metadata": false';
   let journal=[];
   if(mode!=='fresh'){
    await migrate(pool,directory);
    // Seed historical FORCE-RLS records through explicit per-user contexts.
    for(const user of ['A','B']){
     const client=await pool.connect();try{await client.query('BEGIN');await client.query("SELECT set_config('app.user_id',$1,true)",[user]);
      const delta=JSON.stringify({actions:[{before:null,after:{id:'shared',notes}}],projects:[],tags:[],action_tags:[],perspectives:[]});
      await client.query('INSERT INTO state.operations(user_id,operation_id,canonical_payload,result,delta,revision_before,revision_after,created_at) VALUES($1,$2,$3,$4,$5,0,1,$6)',[user,'same-operation','{}','{}',delta,'2026-10-29T00:00:00.000Z']);
      await client.query('COMMIT');}finally{client.release();}
    }
    if(mode==='applied_metadata'){
     const old=await mkdtemp(join(tmpdir(),'action-applied-'));try{await copyFile(join(migrations,'0007_action_metadata_text.sql'),join(old,'0007_action_metadata_text.sql'));await migrate(admin,old);}finally{await rm(old,{recursive:true,force:true});}
    }
    journal=(await pool.query('SELECT version,checksum,applied_at FROM public.schema_migrations ORDER BY version')).rows;
   }
   await migrate(pool,migrations);await migrate(pool,migrations);
   assert.equal((await pool.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='state' AND rowsecurity")).rows[0].n,0);
   assert.equal((await pool.query("SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='state'")).rows[0].n,0);
   const after=(await pool.query('SELECT version,checksum,applied_at FROM public.schema_migrations ORDER BY version')).rows;
   for(const row of journal)assert.deepEqual(after.find(x=>x.version===row.version),row);
   assert.equal(after.some(x=>x.version==='0007_action_metadata_text.sql'),mode==='applied_metadata');
   assert(after.some(x=>x.version==='0009_application_user_scope.sql'));
   const history=(await pool.query('SELECT user_id,canonical_payload,result,delta FROM state.operations ORDER BY user_id')).rows;
   assert.equal(history.length,mode==='fresh'?0:2);
   for(const row of history){assert.equal(row.canonical_payload,'{}');assert.equal(row.result,'{}');assert.deepEqual(JSON.parse(row.delta).actions[0].after,{id:'shared',notes,metadata:''});}
   // Recorded migrations must remain immutable even when their successor exists.
   const altered=await mkdtemp(join(tmpdir(),'action-altered-'));try{
    for(const file of await readdir(migrations))await copyFile(join(migrations,file),join(altered,file));
    const file=join(altered,mode==='applied_metadata'?'0007_action_metadata_text.sql':'0009_application_user_scope.sql');await writeFile(file,(await readFile(file,'utf8'))+'\n-- modified\n');
    await assert.rejects(migrate(pool,altered),/checksum differs/);
   }finally{await rm(altered,{recursive:true,force:true});}
  }finally{await pool.end();await admin.end();}
 });
});
