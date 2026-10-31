import {createTransientModel} from './transient-create';
import type {MovePlacement} from './movement';
import {createNavigationModel} from './navigation';
import type {createDateInputModel} from './date-input';
export type NavigationState=ReturnType<ReturnType<typeof createNavigationModel>['initial']>;
export type DatePair=ReturnType<ReturnType<typeof createDateInputModel>['pair']>;
export interface CatalogContext {type:'project'|'tag';target:string|null;parentId:string|null;token:number}
export interface CatalogSubmission {type:'project'|'tag';target:string|null;parentId?:string|null;name:string;contextToken:number|null;navigation:string;direct?:boolean;selectionVersion?:number}
export interface InteractionViewState {
 navigation:NavigationState;
 returnNavigation:NavigationState|null;
 searchDetailOpen:boolean;
 collapsed:string[];
 /** Add menu, Project/Tag pickers, or the Deadline/Hide until editor opened from its property chip. */
 pickerOpen:'add'|'project'|'tag'|'due'|'defer'|null;
 pickerTarget:string|null;
 projectQuery:string;
 tagQuery:string;
 pickerIndex:number;
 headerMenu:'navigation'|'display'|null;
 activeCatalogSelection:string|null;
 selectionVersion:number;
 creationReveal:{id:string;view:string}|null;
 catalogContext:CatalogContext|null;
 catalogSequence:number;
 catalogToken:number;
 catalogSubmissions:Record<number,CatalogSubmission>;
 catalogName:string;
 catalogComposerOpen:boolean;
 moveChooserOpen:boolean;
 movePlacement:MovePlacement;
 moveDestination:string;
 catalogMoveSource:{kind:'project'|'tag';id:string}|null;
 dateErrors:Record<string,Record<string,string>>;
 duePairs:Record<string,DatePair>;
 deferPairs:Record<string,DatePair>;
 textEditing:string|null;
 /** Unsaved text in the Now capture box; cleared only after its save is confirmed. */
}
export type ViewEvent=
 |{[K in keyof InteractionViewState]:{type:'view.set';field:K;value:InteractionViewState[K]}}[keyof InteractionViewState]
 |{type:'view.navigation';patch:Partial<NavigationState>}
 |{type:'search.open'}
 |{type:'search.query';query:string}
 |{type:'search.clear'}
 |{type:'search.close'}
 |{type:'search.detail';open:boolean}
 |{type:'view.selection';catalog:string|null}
 |{type:'view.collapse';key:string;open?:boolean}
 |{type:'picker.step';direction:number;count:number}
 |{type:'picker.open';kind:'add'|'project'|'tag'|'due'|'defer';target:string|null}
 |{type:'picker.close'}
 |{type:'picker.query';kind:'project'|'tag';query:string}
 |{type:'catalog.next-token'}
 |{type:'catalog.submission';token:number;submission:CatalogSubmission|null}
 |{type:'date.error';id:string;field:string;message:string|null}
 |{type:'date.pair';id:string;kind:'due'|'defer';pair:DatePair}
 |{type:'view.remap';from:string;to:string};
const navigation=createNavigationModel(),transient=createTransientModel();
function cloneNavigation(value:NavigationState):NavigationState{return {...value,statuses:[...value.statuses],...(value.remembered?{remembered:Object.fromEntries(Object.entries(value.remembered).map(([key,settings])=>[key,settings?{...settings,statuses:[...settings.statuses]}:settings]))}: {})};}
export function initialViewState():InteractionViewState{return {navigation:navigation.initial(),returnNavigation:null,searchDetailOpen:false,collapsed:[],pickerOpen:null,pickerTarget:null,projectQuery:'',tagQuery:'',pickerIndex:-1,headerMenu:null,activeCatalogSelection:null,selectionVersion:0,creationReveal:null,catalogContext:null,catalogSequence:0,catalogToken:0,catalogSubmissions:{},catalogName:'',catalogComposerOpen:false,moveChooserOpen:false,movePlacement:'inside',moveDestination:'',catalogMoveSource:null,dateErrors:{},duePairs:{},deferPairs:{},textEditing:null};}
/** Semantic view state changes are pure; DOM measurements and focus effects stay outside. */
export function viewTransition(state:InteractionViewState,event:ViewEvent):InteractionViewState {
 switch(event.type){
  case 'view.set':return state[event.field]===event.value?state:{...state,[event.field]:event.value};
  case 'view.navigation':return {...state,navigation:navigation.select(state.navigation,event.patch),...(event.patch.view&&event.patch.view!=='search'&&state.navigation.view==='search'?{returnNavigation:null,searchDetailOpen:false}:{})};
  case 'search.open':{
   if(state.navigation.view==='search')return state;
   return {...state,navigation:navigation.select(state.navigation,{view:'search',classificationId:'all',perspectiveId:null,includeDescendants:false,statuses:['active','on-hold'],includeDeferred:false,searchQuery:''}),returnNavigation:cloneNavigation(state.navigation),searchDetailOpen:false,pickerOpen:null,pickerTarget:null,pickerIndex:-1,headerMenu:null};
  }
  case 'search.query':return state.navigation.view==='search'&&state.navigation.searchQuery!==event.query?{...state,navigation:{...state.navigation,searchQuery:event.query}}:state;
  case 'search.clear':return state.navigation.view==='search'&&state.navigation.searchQuery!==''?{...state,navigation:{...state.navigation,searchQuery:''}}:state;
  case 'search.close':return state.navigation.view==='search'&&state.returnNavigation?{...state,navigation:cloneNavigation(state.returnNavigation),returnNavigation:null,searchDetailOpen:false}:state;
  case 'search.detail':return state.navigation.view==='search'&&state.searchDetailOpen!==event.open?{...state,searchDetailOpen:event.open}:state;
  case 'view.selection':return {...state,selectionVersion:state.selectionVersion+1,activeCatalogSelection:event.catalog};
  case 'view.collapse':{const open=event.open??state.collapsed.includes(event.key);return {...state,collapsed:open?state.collapsed.filter(key=>key!==event.key):[...new Set([...state.collapsed,event.key])]};}
  case 'picker.open':return {...state,pickerOpen:event.kind,pickerTarget:event.kind==='add'?null:event.target,pickerIndex:-1,projectQuery:event.kind==='project'?'':state.projectQuery,tagQuery:event.kind==='tag'?'':state.tagQuery,headerMenu:null};
  case 'picker.close':return {...state,pickerOpen:null,pickerTarget:null,pickerIndex:-1};
  case 'picker.query':return {...state,[event.kind==='project'?'projectQuery':'tagQuery']:event.query,pickerIndex:-1};
  case 'picker.step':return {...state,pickerIndex:event.count?(state.pickerIndex+event.direction+event.count)%event.count:-1};
  case 'catalog.next-token':return {...state,catalogToken:state.catalogToken+1};
  case 'catalog.submission':{const submissions={...state.catalogSubmissions};if(event.submission)submissions[event.token]={...event.submission};else delete submissions[event.token];return {...state,catalogSubmissions:submissions};}
  case 'date.error':{const errors={...state.dateErrors[event.id]};if(event.message===null)delete errors[event.field];else errors[event.field]=event.message;return {...state,dateErrors:{...state.dateErrors,[event.id]:errors}};}
  case 'date.pair':{const field=event.kind==='due'?'duePairs':'deferPairs';return {...state,[field]:{...state[field],[event.id]:{...event.pair}}};}
  case 'view.remap':{
   const remap=<T>(records:Record<string,T>)=>{if(!Object.hasOwn(records,event.from))return records;const next={...records,[event.to]:records[event.from]};delete next[event.from];return next;};
   return {...state,dateErrors:remap(state.dateErrors),duePairs:remap(state.duePairs),deferPairs:remap(state.deferPairs),creationReveal:state.creationReveal?.id===event.from?{...state.creationReveal,id:event.to}:state.creationReveal,textEditing:state.textEditing===event.from?event.to:state.textEditing,activeCatalogSelection:state.activeCatalogSelection?.endsWith(':'+event.from)?state.activeCatalogSelection.slice(0,-event.from.length)+event.to:state.activeCatalogSelection,navigation:transient.replace(state.navigation,event.from,event.to)};
  }
 }
}

/** Title/Notes editing belongs only to the selected Action; an invalid text proposal stays editable. */
export function normalizeTextEditing(current:string|null,selectedId:string|null,invalidText:boolean):string|null {
 if(!selectedId)return null;
 return current===selectedId||invalidText?selectedId:null;
}

export interface CatalogAcknowledgment {type:'project'|'tag';id:string;sequence:number;token:number;available?:boolean}
export function catalogAcknowledgmentPlan(state:InteractionViewState,created:CatalogAcknowledgment|null,nodes:readonly {id:string;parent_id?:string|null}[],composerName:string){
 if(!created||state.catalogSequence===created.sequence)return {state,select:null,hideComposer:false};
 const submitted=state.catalogSubmissions[created.token],catalogSubmissions={...state.catalogSubmissions};delete catalogSubmissions[created.token];
 let next={...state,catalogSequence:created.sequence,catalogSubmissions};
 if(!submitted)return {state:next,select:null,hideComposer:false};
 const hideComposer=!submitted.direct&&composerName===submitted.name&&state.catalogContext?.token===submitted.contextToken;
 if(hideComposer)next={...next,catalogComposerOpen:false};
 const select=created.available!==false&&submitted.target===null&&JSON.stringify(state.navigation)===submitted.navigation&&(!submitted.direct||submitted.selectionVersion===state.selectionVersion)?{kind:created.type,id:created.id}:null;
 if(select){
  const byId=new Map(nodes.map(node=>[node.id,node])),path=new Set<string>(),seen=new Set<string>();let id:string|null=created.id;
  while(id&&!seen.has(id)){seen.add(id);path.add(created.type+':'+id);id=byId.get(id)?.parent_id||null;}
  next={...next,navigation:navigation.select(state.navigation,{classificationId:created.id}),collapsed:state.collapsed.filter(key=>!path.has(key)),selectionVersion:state.selectionVersion+1,activeCatalogSelection:created.type+':'+created.id,pickerOpen:null,pickerTarget:null,pickerIndex:-1};
 }
 return {state:next,select,hideComposer};
}
