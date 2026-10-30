import {persistedCollaboration,collaborationBlocksReplacement,needsPerson,MAX_ACTION_PROPOSALS} from '../../domain/collaboration';
export {needsPerson} from '../../domain/collaboration';
import type {Collaboration,CollaborationDelegation,CollaborationHistory,CollaborationProposal} from '../../data/types';
import type {DeepReadonly,UiState} from './types';
import {parseRichBlocks,parseRichInline,type RichBlock,type RichInline} from './rich-text';

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
/**
 * Where a decision appears on its card and how it is shown. `primary` decisions carry a short visible word;
 * composer and header decisions are icon-only and keep their full label as the accessible name.
 */
export type CollaborationSlot='primary'|'composer'|'header'|'outcome';
export type CollaborationButton=Readonly<{command:string;label:string;disabled:boolean;slot:CollaborationSlot;text:string|null;icon:string|null}>;
/** Human-facing text parsed for the shared Markdown renderer; caller metadata is never part of it. */
export type CollaborationText=Readonly<{title:readonly RichInline[];instructions:readonly RichBlock[];scope:readonly RichBlock[];outcome:readonly RichBlock[];exclusions:readonly RichBlock[];source:readonly RichBlock[];summary:readonly RichBlock[];remaining:readonly RichBlock[];feedback:readonly RichBlock[]}>;
export type CollaborationTextParser=Readonly<{inline(source:string):readonly RichInline[];blocks(source:string):readonly RichBlock[]}>;
export type CollaborationCard=Readonly<{record:Collaboration;label:string;delegation:ReturnType<typeof delegationView>;feedback:string;edit:Readonly<{version:number;proposal:CollaborationProposal}>|null;editDisabled:boolean;reconciliation:string|null;buttons:readonly CollaborationButton[];handoff:string;history:readonly CollaborationHistory[];text:CollaborationText}>;
export type CollaborationPanelData=Readonly<{enabled:boolean;busy:boolean;showAll:boolean;showToggle:boolean;count:number;action:Readonly<{id:string;title:string}>|null;request:string;requestDisabled:boolean;requestAvailable:boolean;cards:readonly CollaborationCard[]}>;
const presentation:Readonly<Record<string,{slot:CollaborationSlot;text:string|null;icon:string|null}>>={
 accept:{slot:'primary',text:'Approve',icon:null},adopt:{slot:'primary',text:'Create action',icon:null},adopt_delegate:{slot:'primary',text:'Create and delegate',icon:null},link:{slot:'primary',text:'Link to selected action',icon:null},
 request_changes:{slot:'composer',text:null,icon:'send'},respond:{slot:'composer',text:null,icon:'send'},withdraw:{slot:'header',text:null,icon:'stop'},reconcile:{slot:'outcome',text:'Record outcome',icon:null},
};
const plainText:CollaborationTextParser={inline:parseRichInline,blocks:parseRichBlocks};
/**
 * Cards for the selected Action, or in overview every record (`all`), those waiting on the person (`attention`) or
 * open suggestions of new work that no Action holds yet (`suggestions`). `text` parses human-facing fields; pass a
 * caching parser to keep rendered nodes across refreshes.
 */
export type CollaborationScope='all'|'attention'|'suggestions';
export function projectCollaborations(state:DeepReadonly<UiState>,overview=false,scope:CollaborationScope='all',text:CollaborationTextParser=plainText):CollaborationPanelData {
 const enabled=state.data?.collaboration_version===1,records=(enabled?state.data!.collaborations:[]) as readonly Collaboration[];
 const busy=state.busy||state.saving||Boolean(state.unknown)||state.recoveryRequired;
 const action=state.data?.actions.find(row=>row.id===state.selectedId)??null;
 const selected=action&&!state.transients[action.id]?action:null;
 const statusOf=(id:string|null)=>id?state.data?.actions.find(row=>row.id===id)?.status:undefined;
 const inScope=(row:Collaboration)=>scope==='attention'?needsPerson(row,statusOf(row.action_id)):scope==='suggestions'?row.action_id===null&&!['rejected','withdrawn'].includes(row.decision):true;
 const shown=overview?records.filter(inScope):records.filter(row=>row.action_id===selected?.id);
 const cards=shown.map(record=>{
  const feedback=state.collaborationDrafts[record.id]??'',buttons:CollaborationButton[]=[];
  const add=(command:string,label:string,needsText=false)=>buttons.push({command,label,disabled:busy||needsText&&!feedback.trim(),...presentation[command]!});
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
  const proposal=record.proposal,cardText:CollaborationText={title:text.inline(proposal.title),instructions:text.blocks(proposal.instructions),scope:text.blocks(proposal.scope),outcome:text.blocks(proposal.outcome),exclusions:text.blocks(proposal.exclusions),source:text.blocks(proposal.source),summary:text.blocks(record.summary),remaining:text.blocks(record.remaining),feedback:text.blocks(record.feedback)};
  return {record,label,delegation:delegationView(record,(state.data?.clients as {client_id:string;name:string}[]|undefined)??[]),feedback,edit,editDisabled,reconciliation,buttons,handoff,history:state.collaborationHistory[record.id]??[],text:cardText};
 });
 const forSelected=records.filter(row=>row.action_id===selected?.id),requestAvailable=Boolean(selected)&&forSelected.length<MAX_ACTION_PROPOSALS&&!forSelected.some(collaborationBlocksReplacement);
 return {enabled:enabled&&(overview||Boolean(selected)),busy,showAll:overview,showToggle:false,count:records.length,action:selected&&!overview?{id:selected.id,title:selected.title}:null,request:selected?state.collaborationDrafts['action:'+selected.id]??'':'',requestDisabled:busy||!requestAvailable||Boolean(state.drafts[selected?.id??'']?.dirty),requestAvailable,cards};
}

export function validCollaborationSnapshot(value:unknown):boolean {
 const data=value as {collaboration_version?:unknown;collaborations?:unknown}|null;
 if(!data||data.collaboration_version===undefined)return data?.collaborations===undefined;
 if(data.collaboration_version!==1||!Array.isArray(data.collaborations))return false;
 try{const ids=data.collaborations.map(row=>persistedCollaboration(row).id);return new Set(ids).size===ids.length;}catch{return false;}
}

/** One status per record, in the order its label is decided. */
export type CollaborationStatusKind='alert'|'reply'|'result'|'proposal'|'running'|'requested'|'external'|'revising'|'deferred'|'stopped'|'declined';
export type CollaborationStatusTone='attention'|'accent'|'muted';
export type CollaborationStatus=Readonly<{kind:CollaborationStatusKind;icon:string;tone:CollaborationStatusTone;label:string}>;
/** Most urgent first: what blocks on the person, then the person's review, AI work, and closed or parked records. */
const STATUS_ORDER:readonly CollaborationStatusKind[]=['alert','reply','result','proposal','running','requested','external','revising','deferred','stopped','declined'];
const STATUS_LOOK:Readonly<Record<CollaborationStatusKind,{icon:string;tone:CollaborationStatusTone}>>={
 alert:{icon:'alert',tone:'attention'},reply:{icon:'reply',tone:'attention'},result:{icon:'checked',tone:'attention'},
 proposal:{icon:'proposal',tone:'accent'},running:{icon:'running',tone:'accent'},requested:{icon:'deferred',tone:'accent'},
 external:{icon:'hourglass',tone:'muted'},revising:{icon:'edit',tone:'muted'},deferred:{icon:'later',tone:'muted'},stopped:{icon:'stop',tone:'muted'},declined:{icon:'declined',tone:'muted'},
};
export function collaborationStatusKind(record:Collaboration):CollaborationStatusKind {
 if(record.stop_requested||record.outcome==='unknown')return 'alert';
 if(record.decision==='rejected'||record.decision==='withdrawn')return 'declined';
 if(record.decision==='deferred')return 'deferred';
 if(record.decision==='changes_requested')return 'revising';
 if(record.decision==='pending')return 'proposal';
 if(record.progress==='not_started')return 'requested';
 if(record.progress==='waiting')return record.next_actor==='user'?'reply':'external';
 if(record.progress==='running')return 'running';
 if(record.progress==='stopped')return 'stopped';
 return 'result';
}
/**
 * The status an Action row shows for its collaboration records: the most urgent one, named by its label. Records of
 * a completed or dropped Action never ask for attention.
 */
export function actionCollaborationStatus(records:unknown,actionId:string,actionStatus?:string):CollaborationStatus|null {
 if(!Array.isArray(records))return null;
 const own=(records as Collaboration[]).filter(row=>row.action_id===actionId);if(!own.length)return null;
 const kinds=own.map(collaborationStatusKind),kind=STATUS_ORDER.find(item=>kinds.includes(item))!,record=own[kinds.indexOf(kind)]!,count=kinds.filter(item=>item===kind).length;
 const closed=actionStatus==='completed'||actionStatus==='dropped';
 return {kind,icon:STATUS_LOOK[kind].icon,tone:closed?'muted':STATUS_LOOK[kind].tone,label:kind==='proposal'&&count>1?count+' proposals to review':collaborationLabel(record)};
}

export type {CollaborationProposal} from '../../data/types';
