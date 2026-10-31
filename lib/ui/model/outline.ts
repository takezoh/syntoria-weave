import type {OutlineEntry} from './catalog-tree';
import {createCatalogTreeModel} from './catalog-tree';
import type {NavigationSelection,NavigationSnapshot} from './navigation';
import {createNavigationModel} from './navigation';
import type {Drafts} from './drafts';
import type {UiActionRecord} from './ui-projections';

export interface OutlineSnapshot extends Omit<NavigationSnapshot,'actions'> {actions:readonly UiActionRecord[]}
export interface OutlineProjectionInput {
 snapshot:OutlineSnapshot;
 confirmedSnapshot?:NavigationSnapshot|null;
 navigation:NavigationSelection;
 collapsed?:readonly string[];
 creationReveal?:{id:string;view:string}|null;
 drafts?:Drafts;
 depth?:(id:string)=>number;
}
export interface OutlineProjection {
 readonly presentation:ReturnType<ReturnType<typeof createNavigationModel>['present']>;
 readonly tree:boolean;
 readonly flat:boolean;
 readonly entries:readonly OutlineEntry<UiActionRecord>[];
}

/** One readonly row projection feeds rendering, explicit selection and movement choices. */
export function createOutlineModel(navigation=createNavigationModel(),catalogTree=createCatalogTreeModel()){
 function project(input:OutlineProjectionInput):OutlineProjection {
  const {snapshot,confirmedSnapshot,navigation:selection}=input,tree=selection.view==='projects'||selection.view==='tags',flat=selection.view==='search';
  const currentSnapshot=selection.view==='perspective'?(confirmedSnapshot??snapshot as unknown as NavigationSnapshot):snapshot as unknown as NavigationSnapshot;
  const searchSnapshot=flat?{...snapshot,actions:snapshot.actions.map(action=>{const draft=input.drafts?.[action.id];return draft?.dirty?{...action,title:draft.title,notes:draft.notes}:action;})}:snapshot;
  const presentation=flat?navigation.present(searchSnapshot as unknown as NavigationSnapshot,selection):navigation.present(currentSnapshot,selection),actionRows=new Map((flat?searchSnapshot.actions:snapshot.actions).map(action=>[action.id,action]));
  const reveal=input.creationReveal?.view===selection.view?input.creationReveal.id:null;
  let entries:OutlineEntry<UiActionRecord>[];
  if(tree){
   entries=catalogTree.outline(snapshot as unknown as NavigationSnapshot,selection.view as 'projects'|'tags',navigation.displayFilter(selection),input.collapsed||[],reveal).map(entry=>entry.kind==='action'?{...entry,action:actionRows.get(entry.id)??entry.action as UiActionRecord}:entry);
  }else{
   const visible=presentation.actions;
   entries=visible.map(action=>({key:action.id,kind:'action' as const,id:action.id,level:flat?0:Math.min(3,input.depth?.(action.id)??0),label:action.title,parentKey:null,catalogId:null,expandable:false,action:(selection.view==='perspective'?action as UiActionRecord:actionRows.get(action.id)??action as UiActionRecord)}));
   if(!flat&&selection.view!=='perspective'&&reveal&&!entries.some(entry=>entry.id===reveal)){
    const action=actionRows.get(reveal);if(action)entries.push({key:action.id,kind:'action',id:action.id,level:Math.min(3,input.depth?.(action.id)??0),label:action.title,parentKey:null,catalogId:null,expandable:false,action});
   }
  }
  return {presentation,tree,flat,entries};
 }
 return {project};
}
