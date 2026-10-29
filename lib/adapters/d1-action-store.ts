import {fail} from '../domain/core';
import {assertBoundJson,decodeSnapshotRows,planStorageCommit,OPERATION_HISTORY,operationRetentionCutoff,type SnapshotRows,type StorageRowChange,type StorageTableKey} from '../data/model/storage';
import type {ChangeWindow, UserCommitRequest, Receipt, Snapshot} from '../data/types';
import type {UserActionStore, ReadOperationState} from '../application/ports';

async function receipt(db:D1Database,user:string,operationId:string){return db.prepare('SELECT canonical_payload,result,delta,revision_after,undo_of FROM operations WHERE owner=? AND operation_id=?').bind(user,operationId).first<Receipt>();}
function snapshotStatements(db:D1Database,user:string) {
 return [
  db.prepare('SELECT COALESCE(MAX(revision_after),0) AS revision FROM operations WHERE owner=?').bind(user),
  db.prepare('SELECT id,title,revision,parent_id,project_id,status,due_at,defer_until,notes,"order",flagged,created_at,updated_at FROM actions WHERE owner=?').bind(user),
  db.prepare('SELECT id,name,description,parent_id,"order",revision,created_at,updated_at FROM projects WHERE owner=?').bind(user),
  db.prepare('SELECT id,name,description,parent_id,"order",revision,created_at,updated_at FROM tags WHERE owner=?').bind(user),
  db.prepare('SELECT action_id,tag_id,revision FROM action_tags WHERE owner=?').bind(user),
  db.prepare('SELECT kind,identity,revision FROM catalog_identity_ledger WHERE owner=?').bind(user),
  db.prepare('SELECT id,name,description,filter,definition_version,revision,created_at,updated_at FROM perspectives WHERE owner=?').bind(user)
 ];
}

function decodeSnapshot(rows:D1Result[]) {
 return decodeSnapshotRows(rows.map(row=>row.results) as unknown as SnapshotRows);
}

async function snapshot(db:D1Database,user:string):Promise<Snapshot> {
 // One read batch keeps the operation revision and graph in the same snapshot.
 // Reading an empty user does not create any database rows.
 return decodeSnapshot(await db.batch(snapshotStatements(db,user)));
}

async function operationState(db:D1Database,user:string,operationId:string):Promise<ReadOperationState> {
 const rows=await db.batch([
  db.prepare('SELECT canonical_payload,result,delta,revision_after,undo_of FROM operations WHERE owner=? AND operation_id=?').bind(user,operationId),
  ...snapshotStatements(db,user)
 ]);
 const receiptRow=rows[0]?.results[0] as Receipt|undefined;
 let decoded:Snapshot|undefined;
 return {
  receipt:receiptRow??null,
  snapshot:()=>decoded??(decoded=decodeSnapshot(rows.slice(1)))
 };
}

async function changeWindow(db:D1Database,user:string,afterRevision:number,throughRevision:number|null):Promise<ChangeWindow> {
 // The head, retention boundary and selected receipts share one D1 read batch.
 const operationQuery=throughRevision===null
  ?db.prepare('SELECT operation_id,revision_before,revision_after,created_at AS committed_at,undo_of,NULL AS client_id,delta FROM operations WHERE owner=? AND revision_after>? ORDER BY revision_after ASC LIMIT 101').bind(user,afterRevision)
  :db.prepare('SELECT operation_id,revision_before,revision_after,created_at AS committed_at,undo_of,NULL AS client_id,delta FROM operations WHERE owner=? AND revision_after>? AND revision_after<=? ORDER BY revision_after ASC LIMIT 101').bind(user,afterRevision,throughRevision);
 const rows=await db.batch([
  db.prepare('SELECT COALESCE(MAX(revision_after),0) AS revision FROM operations WHERE owner=?').bind(user),
  db.prepare('SELECT MIN(revision_after) AS revision FROM operations WHERE owner=?').bind(user),
  operationQuery
 ]);
 const head=rows[0].results[0] as {revision:number}|undefined,oldest=rows[1].results[0] as {revision:number|null}|undefined;
 if(!head||!oldest)fail('unavailable','Change history is unavailable.',503);
 return {head_revision:head.revision,oldest_revision:oldest.revision,operations:rows[2].results as unknown as ChangeWindow['operations']};
}

/** Closed, immutable table descriptors. Callers cannot supply table, column or key identifiers. */
const TABLES={
 actions:{name:'actions',columns:['id','title','revision','parent_id','project_id','status','due_at','defer_until','notes','order','flagged','created_at','updated_at'],keys:['id']},
 projects:{name:'projects',columns:['id','name','description','parent_id','order','revision','created_at','updated_at'],keys:['id']},
 tags:{name:'tags',columns:['id','name','description','parent_id','order','revision','created_at','updated_at'],keys:['id']},
 perspectives:{name:'perspectives',columns:['id','name','description','filter','definition_version','revision','created_at','updated_at'],keys:['id']},
 action_tags:{name:'action_tags',columns:['action_id','tag_id','revision'],keys:['action_id','tag_id']},
 catalog_identity_ledger:{name:'catalog_identity_ledger',columns:['kind','identity','revision'],keys:['kind','identity']},
} as const;

/** Only changed identities are written; no user-wide DELETE or snapshot JSON. */
function rowStatements(db:D1Database,user:string,key:StorageTableKey,changes:readonly StorageRowChange[]) {
 const {name,columns,keys}=TABLES[key],statements:D1PreparedStatement[]=[];
 const removed=changes.filter(x=>x.after===null).map(x=>x.before);
 if(removed.length){
  const payload=JSON.stringify(removed);assertBoundJson(payload);
  const match=keys.map(k=>`${name}.${k}=json_extract(value,'$.${k}')`).join(' AND ');
  statements.push(db.prepare(`DELETE FROM ${name} WHERE owner=? AND EXISTS (SELECT 1 FROM json_each(?) WHERE ${match})`).bind(user,payload));
 }
 const saved=changes.flatMap(x=>x.after?[x.after]:[]);
 if(saved.length){
  const payload=JSON.stringify(saved);assertBoundJson(payload);
  const values=columns.map(c=>`json_extract(value,'$.${c}')`).join(',');
  const updates=columns.filter(c=>!(keys as readonly string[]).includes(c)).map(c=>`"${c}"=excluded."${c}"`).join(',');
  statements.push(db.prepare(`INSERT INTO ${name} (owner,${columns.map(c=>`"${c}"`).join(',')}) SELECT ?,${values} FROM json_each(?) WHERE 1 ON CONFLICT(owner,${keys.join(',')}) DO UPDATE SET ${updates}`).bind(user,payload));
 }
 return statements;
}

async function commit(db:D1Database,request:UserCommitRequest&{user:string}) {
 const {user,operationId:op,payload,before,now,undoOf}=request;
 const plan=planStorageCommit(request),{changes,result,tables,markerChanges}=plan;
 // The INSERT trigger checks the latest operation revision before any row writes.
 // Receipt, related records and identity markers commit or roll back as one batch.
 const statements=[db.prepare('INSERT INTO operations(owner,operation_id,canonical_payload,result,delta,revision_before,revision_after,undo_of,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(user,op,payload,JSON.stringify(result),JSON.stringify(changes),before.revision,result.revision,undoOf,now)];
 for(const table of tables)statements.push(...rowStatements(db,user,table.key,table.changes));
 statements.push(...rowStatements(db,user,'catalog_identity_ledger',markerChanges));
 // Revisions increase by one per write. Undo receipts are newer than their target,
 // so pruning the oldest prefix cannot lose a retained target's Undo marker.
 // The bound mirrors operationPruneThrough; the new receipt above is always inside the period.
 const head=result.revision;
 statements.push(db.prepare('DELETE FROM operations WHERE owner=? AND revision_after<=MAX(?,MIN(?,COALESCE((SELECT MIN(revision_after) FROM operations WHERE owner=? AND created_at>=?),?)-1))').bind(user,head-OPERATION_HISTORY.maximum,head-OPERATION_HISTORY.minimum,user,operationRetentionCutoff(now),head+1));
 if(statements.length>50)fail('operation_too_large','Generated query count exceeds the storage budget.',413);
 try{await db.batch(statements);}catch(error){
  // A duplicate invocation may already have committed. Resolve identity before
  // classifying a revision error; unrelated database/transport errors stay unknown.
  const message=error instanceof Error?error.message:'';
  const revisionConflict=message.includes('revision_conflict');
  if(!revisionConflict&&!message.includes('UNIQUE constraint failed: operations.owner, operations.operation_id'))throw error;
  const prior=await receipt(db,user,op);
  if(prior){if(prior.canonical_payload!==payload)fail('idempotency_conflict','同じ要求IDに異なる入力が指定されています。',409);return JSON.parse(prior.result);}
  if(revisionConflict)fail('conflict','更新が競合しました。最新状態と未保存案を確認してください。',409);
  throw error;
 }
 return result;
}

export type D1ActionStoreScope=Readonly<{userId:string}>;

/** Bind one validated adapter scope to every SQL path. Authentication belongs to the caller. */
export function createD1ActionStore(db:D1Database,scope:D1ActionStoreScope):UserActionStore {
 const user=scope?.userId;
 if(typeof user!=='string'||user.length===0||user.length>512||user.trim()!==user)fail('unauthenticated','A validated D1 user scope is required.',401);
 return Object.freeze({
 readSnapshot:()=>snapshot(db,user),
 readOperationState:(operationId:string)=>operationState(db,user,operationId),
 readChangeWindow:(afterRevision:number,throughRevision:number|null)=>changeWindow(db,user,afterRevision,throughRevision),
 readReceipt:(operationId:string)=>receipt(db,user,operationId),
 async hasUndo(undoOf:string){return !!await db.prepare('SELECT operation_id FROM operations WHERE owner=? AND undo_of=?').bind(user,undoOf).first();},
 commit:(command:UserCommitRequest)=>commit(db,{...command,user})
 });
}
