import {canonical,change,exact,fail,id,integer,object,text,validateGraph} from '../domain/core';
import {createCollaboration,transitionCollaboration,collaborationTarget,validateProposalCapacity,validateProposalSelection} from '../domain/collaboration';
import {response} from '../domain/operations';
import {parseReceiptResult} from '../data/model/storage';
import {encodeChangeCursor} from '../data/model/change-cursor';
import type {Collaboration,OperationResult,Snapshot} from '../data/types';
import type {UserActionPorts} from './ports';

export async function collaborationCall(ports:UserActionPorts,name:string,args:unknown){
 const {store,newId,clock}=ports,actor=store.collaborationActor;
 if(!actor||!store.readCollaborationHistory)fail('unavailable','This store does not provide collaboration.',503);
 const a=object(args),now=clock();
 async function reply(snapshot:Snapshot,result:OperationResult|null=null){validateGraph(snapshot);return response(snapshot,now,result,encodeChangeCursor(await ports.changeCursorScope(),snapshot.revision));}
 if(name==='list_collaborations'){exact(a,[]);return reply(await store.readSnapshot());}
 if(name==='get_collaboration'){
  exact(a,['id','beforeRevision']);const key=id(a.id),snapshot=await store.readSnapshot();
  const record=snapshot.collaborations?.find(row=>row.id===key);if(!record)fail('not_found','The collaboration is unavailable.',404);
  const entries=await store.readCollaborationHistory(key,a.beforeRevision===undefined?snapshot.revision+1:Math.min(integer(a.beforeRevision),snapshot.revision+1));
  return {...await reply(snapshot),collaboration:record,history:entries,next_before_revision:entries.length===50?entries.at(-1)!.revision:null};
 }
 exact(a,name==='propose_collaboration'?['schemaVersion','operationId','expectedRevision','action_id','proposal','request']:['schemaVersion','operationId','expectedRevision','id','command','payload','action_id','delegate']);
 if(a.schemaVersion!==2)fail('schema_mismatch','Use schemaVersion 2.',409);
 const operationId=id(a.operationId),expected=integer(a.expectedRevision),original=canonical({name,args:a});
 if(new TextEncoder().encode(original).length>65536)fail('operation_too_large','Collaboration requests must fit in 64 KiB.',413);
 const state=await store.readOperationState(operationId);
 if(state.receipt){if(state.receipt.canonical_payload!==original)fail('idempotency_conflict','This operation ID has different input.',409);return reply(state.snapshot(),parseReceiptResult(state.receipt));}
 const before=state.snapshot();if(before.revision!==expected)fail('conflict','Read the current state and retain your proposal.',409);
 if(!before.collaborations)fail('invalid_state','The collaboration snapshot is missing.');
 let after=before,record:Collaboration,command:string,resolved:OperationResult['resolved'];
 const allocate=()=>{for(let i=0;i<8;i++){const key=id(newId());if(key!==operationId&&!before.actions.some(row=>row.id===key)&&!before.collaborations!.some(row=>row.id===key||row.run_id===key)&&![...before.projects,...before.tags,...before.perspectives].some(row=>row.id===key)&&!before.catalog_identity_ledger.some(row=>row.identity===key))return key;}return fail('unavailable','Could not allocate an identity.',503);};
 if(name==='propose_collaboration'){
  command='propose';record=createCollaboration(before,allocate(),a.action_id===null?null:id(a.action_id),a.proposal,now);
  if(a.request!==undefined&&typeof a.request!=='boolean')fail('invalid_input','request must be boolean.');
  if(a.request===true){record=transitionCollaboration(before,record,'accept',{version:1},actor,now);command='request';}
 }else{
  command=text(a.command,40);const current=before.collaborations.find(row=>row.id===id(a.id));if(!current)fail('not_found','The collaboration is unavailable.',404);
  if(command==='adopt'){
   const p=object(a.payload);exact(p,['version']);if(integer(p.version)!==current.version)fail('conflict','Review the current proposal version.',409);
   if(current.action_id!==null||!['pending','deferred'].includes(current.decision))fail('invalid_state','Only a pending new-work proposal can be adopted.');
   if(typeof a.delegate!=='boolean')fail('invalid_input','Choose whether to delegate this work.');
   let actionId:string;
   if(a.action_id===null){actionId=allocate();after=change(before,{kind:'add',payload:{id:actionId,title:current.proposal.title,notes:current.proposal.instructions}},now);resolved={actions:[{id:actionId}]};}
   else{actionId=id(a.action_id);collaborationTarget(before,actionId);}
   validateProposalCapacity(before,actionId,current.id);
   const linked={...current,action_id:actionId};
   record=a.delegate?transitionCollaboration(after,linked,'accept',{version:current.version},actor,now):{...linked,decision:'pending',progress:'not_started',next_actor:'user',revision:before.revision+1,updated_at:now};
  }else{
   if(a.action_id!==undefined||a.delegate!==undefined)fail('invalid_input','Action linking is only available during adoption.');
   record=transitionCollaboration(before,current,command,a.payload,actor,now,command==='start'?allocate():null);
  }
 }
 if(record.decision==='accepted')validateProposalSelection(before,record);
 after={...after,collaborations:[...before.collaborations.filter(row=>row.id!==record.id),record]};
 const result=await store.commit({operationId,payload:original,before,after,now,undoOf:null,resolved,collaboration:{command,actor,record}});
 return reply(await store.readSnapshot(),result);
}
