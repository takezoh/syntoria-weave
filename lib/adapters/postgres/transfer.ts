import type {Pool,PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import {readSnapshotInTransaction} from './action-store';
import {parseReceiptResult,OPERATION_HISTORY} from '../../data/model/storage';
import {validateGraph} from '../../domain/core';
export const transferTables=['state.projects','state.tags','state.actions','state.action_tags','state.perspectives','state.catalog_identity_ledger','state.operations','state.collaborations','state.collaboration_history','identity.subjects'] as const;
const columns:Record<typeof transferTables[number],readonly string[]>={
 'state.projects':['user_id','id','name','description','parent_id','order','revision','created_at','updated_at'],
 'state.tags':['user_id','id','name','description','parent_id','order','revision','created_at','updated_at'],
 'state.actions':['user_id','id','title','notes','metadata','revision','parent_id','project_id','status','due_at','defer_until','order','flagged','created_at','updated_at'],
 'state.action_tags':['user_id','action_id','tag_id','revision'],
 'state.perspectives':['user_id','id','name','description','filter','definition_version','revision','created_at','updated_at'],
 'state.catalog_identity_ledger':['user_id','kind','identity','revision'],
 'state.operations':['user_id','operation_id','canonical_payload','result','delta','revision_before','revision_after','undo_of','created_at','client_id','actor_kind'],
 'state.collaborations':['user_id','id','action_id','revision','body'],
 'state.collaboration_history':['user_id','operation_id','collaboration_id','revision','command','actor','body','canonical_payload','result','delta'],
 'identity.subjects':['issuer','subject','user_id','enabled'],
};
export type Transfer=Readonly<{version:7;tables:Record<string,Record<string,unknown>[]>}>;
export function transferDigest(value:Transfer){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export async function assertTransferPrivilege(client:PoolClient){
 const privilege=(await client.query("SELECT rolsuper OR EXISTS(SELECT 1 FROM pg_roles e WHERE e.rolname='action_export' AND pg_has_role(current_user,e.oid,'member')) AS allowed FROM pg_roles WHERE rolname=current_user")).rows[0];
 if(!privilege?.allowed)throw new Error('An explicitly authorized administrative export/import role is required.');
}
export async function exportData(pool:Pool):Promise<Transfer>{
 const client=await pool.connect();try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await assertTransferPrivilege(client);
  const tables:Transfer['tables']={};for(const table of transferTables)tables[table]=(await client.query('SELECT * FROM '+table+' ORDER BY '+(table.startsWith('state.')?'user_id':'issuer'))).rows;
  await client.query('COMMIT');return {version:7,tables};
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function importData(pool:Pool,value:Transfer,expectedDigest:string){
 if(value.version!==7||transferDigest(value)!==expectedDigest||Object.keys(value.tables).sort().join()!==[...transferTables].sort().join())throw new Error('Invalid transfer manifest or digest.');
 const client=await pool.connect();try{
  await client.query('BEGIN');await assertTransferPrivilege(client);await client.query('SELECT pg_advisory_xact_lock(7247027267111031::bigint)');
  for(const table of transferTables){
   if((await client.query('SELECT 1 FROM '+table+' LIMIT 1')).rowCount)throw new Error('Target is not empty; refusing reset or merge.');
  }
  for(const table of transferTables){const names=columns[table];for(const row of value.tables[table]){
   if(Object.keys(row).sort().join()!==[...names].sort().join())throw new Error('Transfer row does not match the schema.');
   if(table.startsWith('state.'))await client.query("SELECT set_config('app.user_id',$1,true)",[row.user_id]);
   await client.query(`INSERT INTO ${table} (${names.map(x=>'"'+x+'"').join(',')}) VALUES(${names.map((_,i)=>'$'+(i+1)).join(',')})`,names.map(name=>row[name]));
  }}
  // Force constraints before validation; failure leaves no partial import.
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  const users=new Set(transferTables.filter(t=>t.startsWith('state.')).flatMap(t=>value.tables[t].map(row=>String(row.user_id))));
  for(const user of users){await client.query("SELECT set_config('app.user_id',$1,true)",[user]);validateGraph(await readSnapshotInTransaction(client,user));const history=value.tables['state.operations'].filter(row=>row.user_id===user).sort((a,b)=>Number(a.revision_after)-Number(b.revision_after));if(history.length>OPERATION_HISTORY.maximum)throw new Error('History exceeds retention.');for(let i=0;i<history.length;i++){parseReceiptResult(history[i] as unknown as Parameters<typeof parseReceiptResult>[0]);if(i&&Number(history[i].revision_before)!==Number(history[i-1].revision_after))throw new Error('History is discontinuous.');}}
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
