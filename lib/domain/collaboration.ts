import {description,exact,fail,id,integer,object,text} from './core';
import type {Collaboration,CollaborationActor,CollaborationDelegation,CollaborationProposal,Snapshot} from '../data/types';

export function collaborationProposal(value:unknown):CollaborationProposal {
 const p=object(value);exact(p,['title','instructions','scope','outcome','exclusions','source']);
 const result={title:text(p.title),instructions:description(p.instructions),scope:description(p.scope),outcome:description(p.outcome),exclusions:description(p.exclusions),source:description(p.source)};
 if(!result.instructions.trim()||!result.scope.trim()||!result.outcome.trim())fail('invalid_input','Describe the original request, scope and expected outcome.');
 if(JSON.stringify(result).length>32768)fail('operation_too_large','The proposal exceeds 32768 characters.',413);
 return result;
}
/** The mode and the client are separate fields; omission means any AI. */
export function collaborationDelegation(value:unknown):CollaborationDelegation {
 if(value===undefined)return {mode:'any_ai',client_id:null};
 const d=object(value);exact(d,['mode','client_id']);
 if(d.mode==='any_ai'){if(d.client_id!==undefined&&d.client_id!==null)fail('invalid_input','Any AI takes no client_id.');return {mode:'any_ai',client_id:null};}
 if(d.mode==='specified_ai'){if(typeof d.client_id!=='string'||!/^[\x21-\x7e]{1,255}$/u.test(d.client_id))fail('invalid_input','Specify the client_id of the AI connection.');return {mode:'specified_ai',client_id:d.client_id};}
 return fail('invalid_input','delegation.mode must be any_ai or specified_ai.');
}
export function collaborationTarget(snapshot:Snapshot,actionId:string|null){
 if(actionId===null)return null;
 const action=snapshot.actions.find(row=>row.id===id(actionId));
 if(!action)fail('not_found','The action is unavailable.',404);
 return action;
}
export function createCollaboration(snapshot:Snapshot,identity:string,actionId:string|null,proposal:unknown,now:string,delegation?:unknown):Collaboration {
 const action=collaborationTarget(snapshot,actionId);
 if(actionId)validateProposalCapacity(snapshot,actionId);
 return {id:id(identity),action_id:actionId,revision:snapshot.revision+1,version:1,proposal:collaborationProposal(proposal),delegation:collaborationDelegation(delegation),decision:'pending',progress:'not_started',next_actor:'user',feedback:'',summary:'',remaining:'',outcome:'none',artifacts:[],run_id:null,run_actor:null,stop_requested:false,action_revision:action?.revision??null,created_at:now,updated_at:now,last_reported_at:null};
}
export const MAX_ACTION_PROPOSALS=3;
export function validateProposalCapacity(snapshot:Snapshot,actionId:string,excludeId?:string){
 if((snapshot.collaborations??[]).filter(row=>row.action_id===actionId&&row.id!==excludeId).length>=MAX_ACTION_PROPOSALS)fail('conflict','An action can have at most three proposals. Edit an existing proposal.',409);
}
export function collaborationBlocksReplacement(record:Collaboration){return record.decision==='accepted'||record.outcome==='unknown'||record.progress==='running'||record.progress==='waiting'||record.stop_requested;}
export function validateProposalSelection(snapshot:Snapshot,record:Collaboration){
 if(record.action_id&&(snapshot.collaborations??[]).some(row=>row.id!==record.id&&row.action_id===record.action_id&&collaborationBlocksReplacement(row)))fail('conflict','Cancel the other approval and resolve any running or unknown work before selecting this proposal.',409);
}
function running(record:Collaboration){return record.progress==='running'||record.progress==='waiting';}
function available(snapshot:Snapshot,record:Collaboration){
 const action=collaborationTarget(snapshot,record.action_id);
 if(!action||!['active','on-hold'].includes(action.status))fail('invalid_state','An unfinished action is required before starting work.');
 return action;
}
/** All inputs, including identity and time, are supplied by the application boundary. */
export function transitionCollaboration(snapshot:Snapshot,current:Collaboration,command:string,payload:unknown,actor:CollaborationActor,now:string,runId:string|null=null):Collaboration {
 const p=object(payload);exact(p,['version','feedback','proposal','run_id','summary','remaining','outcome','artifacts','next_actor','delegation']);
 if(integer(p.version)!==current.version)fail('conflict','The proposal changed. Read and review its current version.',409);
 const next={...current,revision:snapshot.revision+1,updated_at:now};
 const feedback=()=>description(p.feedback??'');
 if(command==='revise'){
  if(running(current)||current.outcome==='unknown')fail('invalid_state','Resolve the current run and any unknown outcome before revising its scope.');
  return {...next,version:current.version+1,proposal:collaborationProposal(p.proposal),decision:'pending',progress:'not_started',next_actor:'user',feedback:'',summary:'',remaining:'',outcome:'none',artifacts:[],run_id:null,run_actor:null,stop_requested:false,action_revision:collaborationTarget(snapshot,current.action_id)?.revision??null};
 }
 if(['accept','defer','request_changes'].includes(command)){
  if(running(current))fail('invalid_state','This proposal cannot be decided in its current state.');
  if(command==='accept'){
   if(!['pending','deferred','withdrawn','rejected'].includes(current.decision)||current.progress!=='not_started'||current.run_id!==null)fail('invalid_state','Review an unstarted proposal before accepting it.');
   const action=available(snapshot,current);validateProposalSelection(snapshot,current);
   return {...next,decision:'accepted',progress:'not_started',next_actor:'ai',feedback:feedback(),action_revision:action.revision,stop_requested:false,delegation:p.delegation===undefined?current.delegation:collaborationDelegation(p.delegation)};
  }
  if(command!=='request_changes'&&current.progress!=='not_started')fail('invalid_state','This run already ended. Request a revised proposal instead.');
  if(command==='request_changes'&&current.outcome==='unknown')fail('invalid_state','Resolve the unknown outcome before requesting another attempt.');
  if(command==='request_changes'&&!feedback().trim())fail('invalid_input','Describe the requested changes.');
  return {...next,decision:command==='defer'?'deferred':'changes_requested',next_actor:command==='request_changes'?'ai':command==='defer'?'user':'none',feedback:feedback()};
 }
 if(command==='withdraw'){
  if(current.decision!=='accepted')fail('invalid_state','Only an approved proposal can have its approval cancelled.');
  return {...next,decision:'pending',next_actor:running(current)?'ai':'user',stop_requested:running(current),feedback:feedback()};
 }
 if(command==='start'){
  if(current.decision!=='accepted'||current.progress!=='not_started'||current.stop_requested)fail('invalid_state','Only an accepted, unstarted request can start.');
  const action=available(snapshot,current);
  if(action.revision!==current.action_revision)fail('conflict','The action changed after the request was accepted. Revise and review the proposal.',409);
  if(!runId)fail('invalid_state','A run identity is required.');
  return {...next,progress:'running',next_actor:'ai',run_id:id(runId),run_actor:{...actor},last_reported_at:now};
 }
 if(['progress','wait','report','stop'].includes(command)){
  if(!current.run_id||p.run_id!==current.run_id||!current.run_actor||current.run_actor.connection_id!==actor.connection_id||current.run_actor.client_id!==actor.client_id||current.run_actor.kind!==actor.kind)fail('conflict','Only the current run connection can report. Keep late results with their original run.',409);
  if(!running(current)&&!(command==='report'&&current.progress==='reported'&&current.outcome==='unknown'))fail('invalid_state','This run has already ended.');
  const summary=description(p.summary),remaining=description(p.remaining??'');
  if(!summary.trim())fail('invalid_input','Describe what actually happened.');
  if(command==='progress')return {...next,progress:'running',next_actor:'ai',summary,remaining,last_reported_at:now};
  if(command==='wait'){
   if(!['user','external'].includes(String(p.next_actor)))fail('invalid_input','Specify who must respond.');
   return {...next,progress:'waiting',next_actor:p.next_actor as 'user'|'external',summary,remaining,last_reported_at:now};
  }
  if(command==='stop')return {...next,progress:'stopped',next_actor:'user',stop_requested:false,summary,remaining,last_reported_at:now};
  if(!['success','partial','failed','unknown'].includes(String(p.outcome)))fail('invalid_input','Specify the observed outcome.');
  if(!Array.isArray(p.artifacts)||p.artifacts.length>20)fail('invalid_input','Provide at most 20 artifact references.');
  const artifacts=p.artifacts.map(value=>{const a=object(value);exact(a,['label','url']);const url=text(a.url,2048);if(!/^https?:\/\//i.test(url))fail('invalid_input','Artifact references require HTTP or HTTPS.');return {label:text(a.label),url};});
  return {...next,progress:'reported',next_actor:'user',summary,remaining,outcome:p.outcome as Collaboration['outcome'],artifacts,stop_requested:false,last_reported_at:now};
 }
 if(command==='reconcile'){
  if(!current.stop_requested&&current.outcome!=='unknown'&&current.progress!=='stopped')fail('invalid_state','Only an unresolved or stopped run can be reconciled.');
  const summary=description(p.summary),remaining=description(p.remaining??'');
  if(!summary.trim()||!['success','partial','failed','unknown'].includes(String(p.outcome)))fail('invalid_input','Record the observed outcome and the evidence used to verify it.');
  return {...next,progress:'reported',outcome:p.outcome as Collaboration['outcome'],summary,remaining,next_actor:'user',stop_requested:false,last_reported_at:now};
 }
 if(command==='respond'){
  if(current.progress!=='waiting'||current.next_actor!=='user'||current.stop_requested||current.decision!=='accepted')fail('invalid_state','This run is not waiting for your response.');
  if(!feedback().trim())fail('invalid_input','Provide a response.');
  return {...next,progress:'running',next_actor:'ai',feedback:feedback()};
 }
 // Delegation is state any actor may change at any time; nothing else depends on it.
 if(command==='assign'){if(p.delegation===undefined)fail('invalid_input','Specify the delegation.');return {...next,delegation:collaborationDelegation(p.delegation)};}
 if(command==='take_over'){
  if(current.decision!=='accepted')fail('invalid_state','Only approved work can be taken over.');
  return {...next,decision:'pending',stop_requested:running(current),next_actor:running(current)?'ai':'user',feedback:feedback()};
 }
 return fail('invalid_input','Unknown collaboration command.');
}

/** Validate durable records before they cross storage or UI boundaries. */
export function persistedCollaboration(value:unknown):Collaboration {
 const r=object(value);
 const keys=['id','action_id','revision','version','proposal','delegation','decision','progress','next_actor','feedback','summary','remaining','outcome','artifacts','run_id','run_actor','stop_requested','action_revision','created_at','updated_at','last_reported_at'];
 exact(r,keys);if(keys.some(key=>!Object.hasOwn(r,key)))fail('invalid_state','Incomplete collaboration record.');
 id(r.id);if(r.action_id!==null)id(r.action_id);integer(r.revision);if(integer(r.version)<1)fail('invalid_state','Invalid proposal version.');collaborationProposal(r.proposal);
 const enums={decision:['pending','accepted','changes_requested','rejected','deferred','withdrawn'],progress:['not_started','running','waiting','reported','stopped'],next_actor:['user','ai','external','none'],outcome:['none','success','partial','failed','unknown']};
 for(const [key,values] of Object.entries(enums))if(!values.includes(String(r[key])))fail('invalid_state','Invalid collaboration state.');
 for(const key of ['feedback','summary','remaining'])description(r[key]);
 for(const key of ['created_at','updated_at','last_reported_at'])if(r[key]!==null&&(typeof r[key]!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(String(r[key]))||!Number.isFinite(Date.parse(String(r[key])))))fail('invalid_state','Invalid collaboration timestamp.');
 if(typeof r.created_at!=='string'||typeof r.updated_at!=='string'||typeof r.stop_requested!=='boolean')fail('invalid_state','Invalid collaboration metadata.');
 if(r.run_id!==null)id(r.run_id);if(r.action_revision!==null)integer(r.action_revision);
 if(r.run_actor!==null){const actor=object(r.run_actor);exact(actor,['kind','client_id','connection_id']);if(!['user','client'].includes(String(actor.kind)))fail('invalid_state','Invalid report provenance.');text(actor.client_id,255);text(actor.connection_id,1024);}
 if((r.run_id===null)!==(r.run_actor===null))fail('invalid_state','Invalid run identity.');
 {const d=object(r.delegation);exact(d,['mode','client_id']);if(!(d.mode==='any_ai'&&d.client_id===null||d.mode==='specified_ai'&&typeof d.client_id==='string'&&/^[\x21-\x7e]{1,255}$/u.test(d.client_id)))fail('invalid_state','Invalid delegation.');}
 if(!Array.isArray(r.artifacts)||r.artifacts.length>20)fail('invalid_state','Invalid artifact references.');
 for(const item of r.artifacts){const a=object(item);exact(a,['label','url']);text(a.label);if(!/^https?:\/\//i.test(text(a.url,2048)))fail('invalid_state','Invalid artifact URL.');}
 return value as Collaboration;
}

/** Who handles the work, derived: the person unless the record is accepted for any AI or a specified AI. */
export type CollaborationHandler=Readonly<{kind:'person'}|{kind:'any_ai'}|{kind:'specified_ai';client_id:string}>;
export function collaborationHandler(record:Collaboration):CollaborationHandler {
 if(record.decision!=='accepted')return {kind:'person'};
 return record.delegation.mode==='specified_ai'?{kind:'specified_ai',client_id:record.delegation.client_id}:{kind:'any_ai'};
}

/**
 * Whether a record waits on the person: a question for them, a proposal or suggestion to review, a reported
 * result, an unverified outcome or a pending stop, for an Action that is still unfinished (or none yet).
 */
export function needsPerson(record:Pick<Collaboration,'decision'|'progress'|'next_actor'|'outcome'|'stop_requested'>,actionStatus:string|undefined):boolean {
 if(actionStatus==='completed'||actionStatus==='dropped')return false;
 if(record.stop_requested||record.outcome==='unknown')return true;
 if(record.decision==='pending')return record.progress==='not_started';
 if(record.decision!=='accepted')return false;
 return record.progress==='waiting'&&record.next_actor==='user'||record.progress==='reported';
}

export type AssignmentReason='assigned_to_you'|'open_to_any_ai'|'your_run'|'waiting_on_you';
/** Why a record concerns this actor, if it does. A reason is a hint for finding work, never a permission. */
export function assignmentReason(record:Collaboration,actor:CollaborationActor,actionStatus:string|undefined):AssignmentReason|null {
 if(actor.kind==='user')return needsPerson(record,actionStatus)?'waiting_on_you':null;
 const run=record.run_actor;
 if(run&&run.kind===actor.kind&&run.client_id===actor.client_id&&run.connection_id===actor.connection_id&&(record.progress==='running'||record.progress==='waiting'||record.progress==='stopped'||record.stop_requested||record.outcome==='unknown'))return 'your_run';
 if(record.decision!=='accepted')return null;
 if(record.delegation.mode==='specified_ai')return record.delegation.client_id===actor.client_id?'assigned_to_you':null;
 const unfinished=actionStatus==='active'||actionStatus==='on-hold';
 return record.progress==='not_started'&&!record.stop_requested&&unfinished?'open_to_any_ai':null;
}
