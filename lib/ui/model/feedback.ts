import {createAutosaveModel} from './autosave';
import {createCatalogDraftModel} from './catalog-drafts';
import type {DeepReadonly,FeedbackTarget,UiState} from './types';
import type {ScreenProjection} from './screen';
export type FeedbackPane='list'|'action'|'catalog';
export interface RecoveryItem {readonly key:string;readonly label:string;readonly target:FeedbackTarget}
const autosave=createAutosaveModel(),catalogDrafts=createCatalogDraftModel();
const same=(a:DeepReadonly<FeedbackTarget>|null,b:DeepReadonly<FeedbackTarget>|null)=>Boolean(a&&b&&a.kind===b.kind&&a.id===b.id);
/** Feedback provenance and placement depend on state, never on message wording. */
export function projectFeedback(state:DeepReadonly<UiState>,screen:ScreenProjection){
 const pane=(target:DeepReadonly<FeedbackTarget>|null):FeedbackPane=>screen.mode==='mobile'?screen.page:same(target,state.inspector)?target!.kind==='action'?'action':'catalog':'list';
 const recovery:RecoveryItem[]=[];
 const actionValidation=new Map<string,boolean>(),catalogValidation=new Map<string,boolean>();
 const actionInvalid=(id:string)=>{if(!actionValidation.has(id))actionValidation.set(id,Boolean(state.drafts[id]&&Object.keys(autosave.validation(state.drafts[id])).length));return actionValidation.get(id)!;};
 const catalogInvalid=(key:string)=>{if(!catalogValidation.has(key))catalogValidation.set(key,Boolean(state.catalogDrafts[key]&&Object.keys(catalogDrafts.validation(state.catalogDrafts[key])).length));return catalogValidation.get(key)!;};
 for(const [id,draft] of Object.entries(state.drafts))if(draft.dirty||state.saveErrors[id]||state.conflicts[id]?.length||state.fieldIssues[id]||actionInvalid(id))recovery.push({key:'action:'+id,label:(state.saveErrors[id]||state.conflicts[id]?.length||state.fieldIssues[id]||actionInvalid(id)?'Needs attention: ':'Unsaved: ')+(draft.title||'Untitled'),target:{kind:'action',id}});
 for(const [key,draft] of Object.entries(state.catalogDrafts))if(Object.keys(draft.patch).length||state.catalogErrors[key]||state.catalogConflicts[key]?.length||catalogInvalid(key))recovery.push({key,label:(state.catalogErrors[key]||state.catalogConflicts[key]?.length||catalogInvalid(key)?'Needs attention: ':'Unsaved: ')+(draft.name||'Untitled '+draft.kind),target:{kind:draft.kind,id:draft.id}});
 for(const id of [state.retainedActionId,...state.movedActionIds,state.createdActionId])if(id&&!recovery.some(row=>row.key==='action:'+id)&&state.drafts[id]&&state.inspector?.id!==id)recovery.push({key:'action:'+id,label:'Open: '+(state.drafts[id].title||'Untitled'),target:{kind:'action',id}});
 const blocked=state.busy||Boolean(state.unknown)||state.recoveryRequired;
 const target=state.inspector,key=target?target.kind==='action'?target.id:target.kind+':'+target.id:null;
 const dirty=target&&key?(target.kind==='action'?state.drafts[key]?.dirty:Boolean(Object.keys(state.catalogDrafts[key]?.patch||{}).length)):false;
 const localError=target&&key?(target.kind==='action'?state.saveErrors[key]||state.conflicts[key]?.length||state.fieldIssues[key]||actionInvalid(key):state.catalogErrors[key]||state.catalogConflicts[key]?.length||catalogInvalid(key)):false;
 const unknown=Boolean(state.unknown),failure=unknown?'':state.operationError?.message||state.moveIssue?.reason||state.classificationIssue?.reason||'';
 const request=state.unknown,args=request?.args,payload=args?.payload as Readonly<Record<string,unknown>>|undefined,kind=String(args?.kind||'');
 const unknownTarget:FeedbackTarget|null=request?.targetId?{kind:'action',id:request.targetId}:payload?.id?{kind:kind.startsWith('project_')?'project':kind.startsWith('tag_')?'tag':'action',id:String(payload.id)}:null;
 const count=recovery.length+Number(unknown||state.recoveryRequired)+Number(Boolean(failure));
 const notice=state.operationNotice;
 return {
  read:{kind:state.readStatus,label:state.readStatus==='refreshing'?'Refreshing…':state.readStatus==='error'?'Could not refresh. Retry Refresh.':state.readStatus==='ready'?'Up to date.':'Refresh',busy:state.readStatus==='refreshing'},
  notice:notice?{...notice,pane:pane(notice.target),undoDisabled:blocked||Boolean(state.pendingUndo)}:null,
  advisory:state.advisoryNotice&&!unknown&&!failure&&!(state.advisoryNotice.kind==='error'&&(Object.keys(state.saveErrors).length||Object.keys(state.catalogErrors).length))?{...state.advisoryNotice,pane:pane(state.advisoryNotice.target)}:null,
  recovery, count, recoveryOpen:state.recoveryOpen&&recovery.length>0,
  recoveryPane:screen.page, unknownPane:pane(unknownTarget), failurePane:screen.mode==='mobile'?screen.page:'list' as const, unknown, recoveryRequired:state.recoveryRequired,
  failure, blocked, checkDisabled:state.busy,
  local:dirty||localError?{pane:target?.kind==='action'?'action' as const:'catalog' as const,text:localError?'Changes need attention':state.saving?'Saving changes':'Changes waiting to save',retryId:target?.kind==='action'&&key&&state.saveErrors[key]&&dirty&&!blocked&&!state.conflicts[key]?.length&&!actionInvalid(key)&&state.data?.actions.some(row=>row.id===key)?key:null}:null,
 };
}
export type FeedbackProjection=ReturnType<typeof projectFeedback>;
