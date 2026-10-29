import type {Pool,PoolClient,QueryResultRow} from 'pg';
import {createHash} from 'node:crypto';
import {fail} from '../../domain/core';
import {decodeSnapshotRows,planStorageCommit,parseReceiptResult,operationPruneThrough,operationRetentionCutoff,type SnapshotRows,type StorageTableKey} from '../../data/model/storage';
import type {Snapshot,Receipt,UserCommitRequest,ChangeWindow} from '../../data/types';
import type {UserActionStore,ReadOperationState} from '../../application/ports';
import {verifyPrincipal,type Principal} from '../../server/node/principal';

type Row=Record<string,unknown>;
const tables={
 actions:{columns:['id','title','revision','parent_id','project_id','status','due_at','defer_until','notes','metadata','order','flagged','created_at','updated_at'],keys:['id'],text:['title','notes','metadata']},
 projects:{columns:['id','name','description','parent_id','order','revision','created_at','updated_at'],keys:['id'],text:['name','description']},
 tags:{columns:['id','name','description','parent_id','order','revision','created_at','updated_at'],keys:['id'],text:['name','description']},
 perspectives:{columns:['id','name','description','filter','definition_version','revision','created_at','updated_at'],keys:['id'],text:['name','description']},
 action_tags:{columns:['action_id','tag_id','revision'],keys:['action_id','tag_id'],text:[]},
 catalog_identity_ledger:{columns:['kind','identity','revision'],keys:['kind','identity'],text:[]},
} as const;
const integerFields=new Set(['revision','revision_before','revision_after','order']);
function number(value:unknown) {const n=Number(value);if(!Number.isSafeInteger(n)||n<0)fail('invalid_state','Stored integer is outside the API range.');return n;}
function decoded(row:Row,text:readonly string[]) {
 return Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value===null?null:integerFields.has(key)?number(value):text.includes(key)?JSON.parse(String(value)):key==='flagged'?(value?1:0):value]));
}
// The versioned lock namespace is stable across terminology changes.
export function userLockKey(user:string) {return createHash('sha256').update('action-tools/owner-commit/v1\0'+user).digest().readBigInt64BE(0).toString();}
export function cursorScope(user:string,epoch:string) {return createHash('sha256').update('action-tools/change-cursor/scope/v2\0'+user+'\0'+epoch).digest('base64url');}
export async function userTransaction<T>(pool:Pool,user:string,readOnly:boolean,fn:(client:PoolClient)=>Promise<T>,signal?:AbortSignal,observe?:(phase:'pool_wait'|'sql',ms:number)=>void):Promise<T> {
 const start=performance.now(),client=await pool.connect();observe?.('pool_wait',performance.now()-start);let broken=false,commitSent=false;
 try {
  await client.query(readOnly?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN ISOLATION LEVEL READ COMMITTED');
  await client.query("SELECT set_config('app.user_id',$1,true)",[user]);
  const guarded=new Proxy(client,{get(target,key){if(key==='query')return (...args:Parameters<PoolClient['query']>)=>{if(signal?.aborted)fail('outcome_unknown','Request deadline elapsed.',503);const begin=performance.now();return Promise.resolve(Reflect.apply(target.query,target,args)).finally(()=>observe?.('sql',performance.now()-begin));};return Reflect.get(target,key);}});
  const result=await fn(guarded);if(signal?.aborted)fail('outcome_unknown','Request deadline elapsed.',503);commitSent=true;await client.query('COMMIT');return result;
 } catch(error) {
  broken=commitSent;
  try{await client.query('ROLLBACK');}catch{broken=true;}
  throw error;
 } finally {client.release(broken);}
}
async function receipt(client:PoolClient,user:string,operationId:string):Promise<Receipt|null> {
 const row=(await client.query('SELECT canonical_payload,result,delta,revision_after,undo_of FROM state.operations WHERE user_id=$1 AND operation_id=$2',[user,operationId])).rows[0];
 return row?{...row,revision_after:number(row.revision_after)}:null;
}
function decodeRows(captured:QueryResultRow[][]):Snapshot {
 const keys=["actions","projects","tags","action_tags","catalog_identity_ledger","perspectives"] as const;
 return decodeSnapshotRows([captured[0].map(row=>({revision:number(row.revision)})),...keys.map((key,i)=>captured[i+1].map(row=>decoded(row,tables[key].text)))] as unknown as SnapshotRows);
}
async function rows(client:PoolClient,user:string):Promise<QueryResultRow[][]> {
 const revision=(await client.query('SELECT COALESCE(MAX(revision_after),0) AS revision FROM state.operations WHERE user_id=$1',[user])).rows;
 const data:QueryResultRow[][]=[];
 for(const key of ['actions','projects','tags','action_tags','catalog_identity_ledger','perspectives'] as const){
  const descriptor=tables[key];const result=await client.query(`SELECT ${descriptor.columns.map(c=>'"'+c+'"').join(',')} FROM state.${key} WHERE user_id=$1`,[user]);
  data.push(result.rows);
 }
 return [revision,...data];
}
export async function readSnapshotInTransaction(client:PoolClient,user:string){return decodeRows(await rows(client,user));}
async function persist(client:PoolClient,user:string,key:StorageTableKey,changes:readonly {before:object|null;after:object|null}[]) {
 const descriptor=tables[key],columns=descriptor.columns as readonly string[],text=descriptor.text as readonly string[];
 const quote=(column:string)=>'"'+column+'"';
 // Bound parameter counts while keeping all chunks in the same user transaction.
 for(const removing of [true,false]){
  const selected=changes.filter(change=>(change.after===null)===removing);
  for(let offset=0;offset<selected.length;offset+=100){
   const chunk=selected.slice(offset,offset+100),values:unknown[]=[user];
   if(removing){
    const conditions=chunk.map(change=>{const row=change.before as Row;return '('+descriptor.keys.map(column=>{values.push(row[column]);return quote(column)+'=$'+values.length;}).join(' AND ')+')';});
    await client.query(`DELETE FROM state.${key} WHERE user_id=$1 AND (${conditions.join(' OR ')})`,values);
   }else{
    const tuples=chunk.map(change=>{const row=change.after as Row;return '($1,'+columns.map(column=>{values.push(text.includes(column)?JSON.stringify(row[column]):column==='flagged'?!!row[column]:row[column]);return '$'+values.length;}).join(',')+')';});
    await client.query(`INSERT INTO state.${key} (user_id,${columns.map(quote).join(',')}) VALUES ${tuples.join(',')} ON CONFLICT (user_id,${descriptor.keys.map(quote).join(',')}) DO UPDATE SET ${columns.filter(column=>!(descriptor.keys as readonly string[]).includes(column)).map(column=>quote(column)+'=excluded.'+quote(column)).join(',')}`,values);
   }
  }
 }
}
/** Every query uses the capability user and transaction-local RLS context. */
export function createPostgresActionStore(pool:Pool,identity:Principal,{revalidate=async()=>{},signal,observe}:{revalidate?:(client:PoolClient)=>Promise<void>;signal?:AbortSignal;observe?:(phase:'pool_wait'|'sql',ms:number)=>void}={}):UserActionStore {
 const {user,clientId,actorKind}=verifyPrincipal(identity);
 const read=<T>(fn:(client:PoolClient)=>Promise<T>)=>userTransaction(pool,user,true,fn,signal,observe);
 return Object.freeze({
  readSnapshot:()=>read(async client=>decodeRows(await rows(client,user))),
  readOperationState:(op:string)=>read(async client=>{
   const prior=await receipt(client,user,op),captured=await rows(client,user);let snapshot:Snapshot|undefined;
   return {receipt:prior,snapshot:()=>snapshot??(snapshot=decodeRows(captured))} satisfies ReadOperationState;
  }),
  readReceipt:(op:string)=>read(client=>receipt(client,user,op)),
  hasUndo:(op:string)=>read(async client=>!!(await client.query('SELECT 1 FROM state.operations WHERE user_id=$1 AND undo_of=$2',[user,op])).rowCount),
  readChangeWindow:(after:number,through:number|null)=>read(async client=>{
   const limits=(await client.query('SELECT COALESCE(MAX(revision_after),0) AS head, MIN(revision_after) AS oldest FROM state.operations WHERE user_id=$1',[user])).rows[0];
   const operations=(await client.query('SELECT operation_id,revision_before,revision_after,created_at AS committed_at,undo_of,client_id,actor_kind,delta FROM state.operations WHERE user_id=$1 AND revision_after>$2 AND ($3::bigint IS NULL OR revision_after<=$3) ORDER BY revision_after LIMIT 101',[user,after,through])).rows;
   return {head_revision:number(limits.head),oldest_revision:limits.oldest===null?null:number(limits.oldest),operations:operations.map(row=>({...row,revision_before:number(row.revision_before),revision_after:number(row.revision_after)}))} as ChangeWindow;
  }),
  async commit(command:UserCommitRequest){
   const plan=planStorageCommit(command);
   return userTransaction(pool,user,false,async client=>{
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)',[userLockKey(user)]);
    await revalidate(client);
    const prior=await receipt(client,user,command.operationId);
    if(prior){if(prior.canonical_payload!==command.payload)fail('idempotency_conflict','Operation ID already has different input.',409);return parseReceiptResult(prior);}
    const current=number((await client.query('SELECT COALESCE(MAX(revision_after),0) AS revision FROM state.operations WHERE user_id=$1',[user])).rows[0].revision);
    if(current!==command.before.revision)fail('conflict','State changed; preserve the proposal and reread.',409);
    await client.query('INSERT INTO state.operations(user_id,operation_id,canonical_payload,result,delta,revision_before,revision_after,undo_of,created_at,client_id,actor_kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[user,command.operationId,command.payload,JSON.stringify(plan.result),JSON.stringify(plan.changes),current,plan.result.revision,command.undoOf,command.now,clientId,actorKind]);
    for(const table of plan.tables)await persist(client,user,table.key,table.changes);
    await persist(client,user,'catalog_identity_ledger',plan.markerChanges);
    // Canonical ISO instants order bytewise; the scan stops at the first operation inside the period.
    const recent=(await client.query('SELECT revision_after FROM state.operations WHERE user_id=$1 AND created_at COLLATE "C">=$2 ORDER BY revision_after LIMIT 1',[user,operationRetentionCutoff(command.now)])).rows[0];
    await client.query('DELETE FROM state.operations WHERE user_id=$1 AND revision_after<=$2',[user,operationPruneThrough(plan.result.revision,recent?number(recent.revision_after):null)]);
    return plan.result;
   },signal,observe);
  }
 });
}
