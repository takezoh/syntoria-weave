import {delta} from '../../lib/domain/operations.ts';
import {fail} from '../../lib/domain/core.ts';
import {operationPruneThrough,operationRetentionCutoff} from '../../lib/data/model/storage.ts';
/** Semantic fake: no SQL, isolated user snapshots, receipts and atomic CAS. */
export function memoryActionStore() {
 const users=new Map(),receipts=new Map();
 const key=(user,id)=>JSON.stringify([user,id]);
 const empty=()=>({revision:0,catalog_identity_ledger:[],actions:[],projects:[],tags:[],action_tags:[],perspectives:[]});
 let lose=false;
 const store={
  async readSnapshot(user){if(!users.has(user))users.set(user,empty());return structuredClone(users.get(user));},
  async readOperationState(user,id){
   const [receipt,snapshot]=await Promise.all([store.readReceipt(user,id),store.readSnapshot(user)]),captured=structuredClone(snapshot);
   return {receipt,snapshot:()=>structuredClone(captured)};
  },
  async readChangeWindow(user,afterRevision,throughRevision=null){
   const retained=[...receipts].filter(([receiptKey])=>JSON.parse(receiptKey)[0]===user).map(([receiptKey,value])=>({operation_id:JSON.parse(receiptKey)[1],...value})).sort((a,b)=>a.revision_after-b.revision_after);
   return structuredClone({head_revision:users.get(user)?.revision??0,oldest_revision:retained[0]?.revision_after??null,operations:retained.filter(row=>row.revision_after>afterRevision&&(throughRevision===null||row.revision_after<=throughRevision))});
  },
  async readReceipt(user,id){return structuredClone(receipts.get(key(user,id))??null);},
  async hasUndo(user,undoOf){return [...receipts].some(([k,r])=>JSON.parse(k)[0]===user&&r.undo_of===undoOf);},
  async commit(r){
   const changes=delta(r.before,r.after),result={operationId:r.operationId,revision:r.before.revision+1,changedIds:changes.actions.map(x=>(x.after??x.before).id),...(r.resolved?{resolved:r.resolved}:{})};
   const prior=receipts.get(key(r.user,r.operationId));
   if(prior){if(prior.canonical_payload!==r.payload)fail('idempotency_conflict','same ID, different input',409);return JSON.parse(prior.result);}
   if((users.get(r.user)?.revision??0)!==r.before.revision)fail('conflict','stale revision',409);
   users.set(r.user,structuredClone({...r.after,revision:r.before.revision+1}));
   receipts.set(key(r.user,r.operationId),{canonical_payload:r.payload,result:JSON.stringify(result),delta:JSON.stringify(changes),revision_before:r.before.revision,revision_after:result.revision,committed_at:r.now,undo_of:r.undoOf,client_id:null});
   const owned=[...receipts].filter(([k])=>JSON.parse(k)[0]===r.user),cutoff=operationRetentionCutoff(r.now);
   const firstRecent=owned.map(([,receipt])=>receipt).filter(receipt=>receipt.committed_at>=cutoff).reduce((first,receipt)=>Math.min(first,receipt.revision_after),Infinity);
   const through=operationPruneThrough(result.revision,firstRecent===Infinity?null:firstRecent);
   for(const [k,receipt] of owned)if(receipt.revision_after<=through)receipts.delete(k);
   if(lose){lose=false;throw new Error('lost response after commit');}
   return structuredClone(result);
  },
  lose(){lose=true;}
 };
 return store;
}
