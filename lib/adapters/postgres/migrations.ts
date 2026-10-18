import type {Pool} from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
/** A separate migrator connection serializes the checksummed journal and transactional DDL. */
export async function migrate(pool:Pool,directory:string) {
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(7247027267111031::bigint)');
  await client.query('CREATE TABLE IF NOT EXISTS public.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  for(const file of (await readdir(directory)).filter(x=>/^\d+_[a-z_]+\.sql$/.test(x)).sort()){
   const sql=await readFile(resolve(directory,file),'utf8'),hash=createHash('sha256').update(sql).digest('hex');
   const prior=(await client.query('SELECT checksum FROM public.schema_migrations WHERE version=$1',[file])).rows[0];
   if(prior){if(prior.checksum!==hash)throw new Error('Applied migration checksum differs: '+file);continue;}
   await client.query(sql);await client.query('INSERT INTO public.schema_migrations(version,checksum) VALUES($1,$2)',[file,hash]);
  }
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function grantRuntime(pool:Pool,role:string) {
 if(!/^[a-z][a-z0-9_]{0,62}$/.test(role))throw new Error('Invalid role identifier.');
 // Identifiers are closed by the role-name grammar; values never become SQL identifiers.
 await pool.query(`GRANT USAGE ON SCHEMA state,identity TO "${role}"`);
 await pool.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON state.actions,state.projects,state.tags,state.action_tags,state.catalog_identity_ledger,state.perspectives TO "${role}"`);
 await pool.query(`GRANT SELECT,INSERT,DELETE ON state.operations TO "${role}"`);
 await pool.query(`GRANT SELECT ON identity.subjects,identity.client_grants,public.schema_migrations TO "${role}"`);
 await pool.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON identity.sessions,identity.login_attempts TO "${role}"`);
 await pool.query(`ALTER ROLE "${role}" CONNECTION LIMIT 40`);
}
export async function checkRuntime(pool:Pool) {
 const info=(await pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
 if(info.rolsuper||info.rolbypassrls)throw new Error('Runtime role must not bypass row security.');
 const owned=await pool.query("SELECT 1 FROM pg_tables WHERE schemaname IN ('state','identity') AND tableowner=current_user");
 const exported=await pool.query("SELECT 1 FROM pg_roles e WHERE e.rolname='action_export' AND pg_has_role(current_user,e.oid,'member')");if(exported.rowCount)throw new Error('Runtime role must not export all users.');
 const capacity=(await pool.query('SHOW max_connections')).rows[0].max_connections;if(Number(capacity)<64)throw new Error('Database connection capacity must be at least 64.');
 if(owned.rowCount)throw new Error('Runtime role must not own application tables.');
 const schema=await pool.query("SELECT version FROM public.schema_migrations ORDER BY version");
 if(schema.rows.map(row=>row.version).join(',')!=='0001_state.sql,0002_user_identity.sql')throw new Error('Incompatible schema version.');
}
export async function grantExport(pool:Pool,role:string) {
 if(!/^[a-z][a-z0-9_]{0,62}$/.test(role))throw new Error('Invalid role identifier.');
 if(role==='action_runtime')throw new Error('Runtime role cannot export all users.');
 if(!(await pool.query("SELECT 1 FROM pg_roles WHERE rolname='action_export'")).rowCount)await pool.query('CREATE ROLE action_export NOLOGIN');
 if(role!=='action_export')await pool.query(`GRANT action_export TO "${role}"`);
 await pool.query(`GRANT USAGE ON SCHEMA state,identity TO "${role}"`);
 await pool.query(`GRANT SELECT ON ALL TABLES IN SCHEMA state,identity TO "${role}"`);
 await pool.query(`GRANT SELECT ON public.schema_migrations TO "${role}"`);
 for(const name of ['actions','projects','tags','action_tags','perspectives','catalog_identity_ledger','operations']){
  await pool.query(`DROP POLICY IF EXISTS export_access ON state.${name}`);
  await pool.query(`CREATE POLICY export_access ON state.${name} FOR SELECT TO action_export USING (true)`);
 }
}
