import {persistedCollaboration,collaborationBlocksReplacement,needsPerson,MAX_ACTION_PROPOSALS} from '../../domain/collaboration';
export {needsPerson} from '../../domain/collaboration';
import type {Collaboration,CollaborationDelegation,CollaborationHistory,CollaborationProposal} from '../../data/types';
import type {DeepReadonly,UiState} from './types';

export function collaborationLabel(record:Collaboration):string {
 if(record.stop_requested)return 'Stop requested — awaiting confirmation';
 if(record.outcome==='unknown')return 'Outcome unknown — verify before retrying';
 if(record.decision==='rejected')return 'Not approved';
 if(record.decision==='withdrawn')return 'Approval cancelled';
 if(record.decision==='deferred')return 'Decision deferred';
 if(record.decision==='changes_requested')return 'Revision requested';
 if(record.decision==='pending')return record.action_id?'Proposal to review':'New work suggestion';
 if(record.progress==='not_started')return 'Requested — not started';
 if(record.progress==='waiting')return record.next_actor==='user'?'Your response is needed':'Waiting for an external response';
 if(record.progress==='running')return 'Work in progress — last reported state';
 if(record.progress==='stopped')return 'Stopped';
 if(record.outcome==='partial')return 'Partial result — review remaining work';
 if(record.outcome==='failed')return 'Work failed — review the report';
 return record.outcome==='none'?'Ready for you':'Result to review';
}
export type DelegationChoice=Readonly<{label:string;delegation:CollaborationDelegation}>;
/** Unapproved work is the person's; approved work is for any AI or the specified one. Names are display data. */
export function delegationView(record:Collaboration,clients:readonly {client_id:string;name:string}[]):Readonly<{handler:string;runner:string|null;choices:readonly DelegationChoice[];selected:number}> {
 const name=(clientId:string)=>clients.find(row=>row.client_id===clientId)?.name??'AI connection '+clientId.slice(0,8);
 const ids=[...new Set([...clients.map(row=>row.client_id),...(record.delegation.mode==='specified_ai'?[record.delegation.client_id]:[]),...(record.run_actor?.kind==='client'?[record.run_actor.client_id]:[])])];
 const choices:DelegationChoice[]=[{label:'Any AI',delegation:{mode:'any_ai',client_id:null}},...ids.map(clientId=>({label:name(clientId),delegation:{mode:'specified_ai',client_id:clientId} as const}))];
 const selected=record.delegation.mode==='any_ai'?0:choices.findIndex(choice=>choice.delegation.client_id===record.delegation.client_id);
 const target=record.delegation.mode==='any_ai'?'any AI':name(record.delegation.client_id);
 return {handler:record.decision==='accepted'?'For '+target:'Yours until approved · then for '+target,runner:record.run_actor?'Started by '+(record.run_actor.kind==='user'?'you':name(record.run_actor.client_id)):null,choices,selected};
}
export type CollaborationCard=Readonly<{record:Collaboration;label:string;delegation:ReturnType<typeof delegationView>;feedback:string;edit:Readonly<{version:number;proposal:CollaborationProposal}>|null;editDisabled:boolean;reconciliation:string|null;buttons:readonly Readonly<{command:string;label:string;disabled:boolean}>[];handoff:string;history:readonly CollaborationHistory[]}>;
export type CollaborationPanelData=Readonly<{enabled:boolean;busy:boolean;showAll:boolean;showToggle:boolean;count:number;action:Readonly<{id:string;title:string}>|null;request:string;requestDisabled:boolean;cards:readonly CollaborationCard[]}>;
export function projectCollaborations(state:DeepReadonly<UiState>,overview=false,attention=false):CollaborationPanelData {
 const enabled=state.data?.collaboration_version===1,records=(enabled?state.data!.collaborations:[]) as readonly Collaboration[];
 const busy=state.busy||state.saving||Boolean(state.unknown)||state.recoveryRequired;
 const action=state.data?.actions.find(row=>row.id===state.selectedId)??null;
 const selected=action&&!state.transients[action.id]?action:null;
 const statusOf=(id:string|null)=>id?state.data?.actions.find(row=>row.id===id)?.status:undefined;
 const shown=overview?records.filter(row=>!attention||needsPerson(row,statusOf(row.action_id))):records.filter(row=>row.action_id===selected?.id);
 const cards=shown.map(record=>{
  const feedback=state.collaborationDrafts[record.id]??'',buttons:{command:string;label:string;disabled:boolean}[]=[];
  const add=(command:string,label:string,needsText=false)=>buttons.push({command,label,disabled:busy||needsText&&!feedback.trim()});
  const active=record.progress==='running'||record.progress==='waiting',edit=state.collaborationEdits[record.id]??null;
  const otherSelected=records.some(row=>row.id!==record.id&&row.action_id===record.action_id&&record.action_id!==null&&collaborationBlocksReplacement(row));
  const editDisabled=busy||active||record.outcome==='unknown';
  if(!active&&!edit&&!otherSelected&&record.progress==='not_started'&&['pending','deferred','rejected','withdrawn'].includes(record.decision)){
   if(record.action_id)add('accept','Approve this proposal');
   else{add('adopt','Create action');add('adopt_delegate','Create action and delegate');if(selected)add('link','Link to selected action');}
  }
  if(!active&&!['withdrawn','rejected'].includes(record.decision)&&record.outcome!=='unknown'){
   add('request_changes','Ask AI to revise',true);
  }
  if(record.progress==='waiting'&&record.next_actor==='user'&&!record.stop_requested&&record.decision==='accepted')add('respond','Send response',true);
  if(record.decision==='accepted'&&!record.stop_requested){add('withdraw',active?'Cancel approval and request stop':'Cancel approval');}
  const reconciliation=record.stop_requested||record.outcome==='unknown'||record.progress==='stopped'?state.collaborationOutcomes[record.id]??'unknown':null;
  if(reconciliation!==null)add('reconcile','Record verified outcome',true);
  const handoff=`Read collaboration ${record.id}${record.action_id?` for action ${record.action_id}`:''} using get_collaboration, then read current state before continuing. Proposal version: ${record.version}.\n${record.proposal.instructions}\nScope: ${record.proposal.scope}\nExpected outcome: ${record.proposal.outcome}\nExcluded: ${record.proposal.exclusions}\nAcceptance records work intent only; obtain external permissions through your execution environment. Report actual progress and unknown outcomes; do not complete the action automatically.`;
  const target=state.data?.actions.find(action=>action.id===record.action_id),inactive=target&&['completed','dropped'].includes(target.status??'');
  const label=inactive&&record.progress==='not_started'?'Action is no longer unfinished — work cannot start':collaborationLabel(record);
  return {record,label,delegation:delegationView(record,(state.data?.clients as {client_id:string;name:string}[]|undefined)??[]),feedback,edit,editDisabled,reconciliation,buttons,handoff,history:state.collaborationHistory[record.id]??[]};
 });
 return {enabled:enabled&&(overview||Boolean(selected)),busy,showAll:overview,showToggle:false,count:records.length,action:selected&&!overview?{id:selected.id,title:selected.title}:null,request:selected?state.collaborationDrafts['action:'+selected.id]??'':'',requestDisabled:busy||!selected||Boolean(state.drafts[selected?.id??'']?.dirty)||records.filter(row=>row.action_id===selected?.id).length>=MAX_ACTION_PROPOSALS||records.some(row=>row.action_id===selected?.id&&collaborationBlocksReplacement(row)),cards};
}

export function validCollaborationSnapshot(value:unknown):boolean {
 const data=value as {collaboration_version?:unknown;collaborations?:unknown}|null;
 if(!data||data.collaboration_version===undefined)return data?.collaborations===undefined;
 if(data.collaboration_version!==1||!Array.isArray(data.collaborations))return false;
 try{const ids=data.collaborations.map(row=>persistedCollaboration(row).id);return new Set(ids).size===ids.length;}catch{return false;}
}

export function actionCollaborationLabel(records:unknown,actionId:string):string {
 if(!Array.isArray(records))return '';
 const record=(records as Collaboration[]).find(row=>row.action_id===actionId&&collaborationBlocksReplacement(row));
 return record?collaborationLabel(record):'';
}

/** Proposals on an Action that are still the person's to approve; approved or closed work is not counted. */
export function actionProposalCount(records:unknown,actionId:string):number {
 if(!Array.isArray(records))return 0;
 return (records as Collaboration[]).filter(row=>row.action_id===actionId&&row.progress==='not_started'&&['pending','deferred','changes_requested'].includes(row.decision)).length;
}

export type {CollaborationProposal} from '../../data/types';
