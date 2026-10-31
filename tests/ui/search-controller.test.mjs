import test from 'node:test';
import assert from 'node:assert/strict';
import {createUiController} from '../../lib/ui/application/controller.ts';
import {createAutosaveModel} from '../../lib/ui/model/autosave.ts';
import * as drafts from '../../lib/ui/model/drafts.ts';
import * as operations from '../../lib/ui/model/operations.ts';
import {createCatalogDraftModel} from '../../lib/ui/model/catalog-drafts.ts';
import {createCatalogTreeModel} from '../../lib/ui/model/catalog-tree.ts';
import {createMovementModel} from '../../lib/ui/model/movement.ts';
import {createNavigationModel} from '../../lib/ui/model/navigation.ts';
import {createOutlineModel} from '../../lib/ui/model/outline.ts';
import {createTransientModel} from '../../lib/ui/model/transient-create.ts';
import {createTreeDropModel} from '../../lib/ui/model/tree-drop.ts';

const parent='11111111-1111-4111-8111-111111111111';
const child='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';

test('controller publishes one search outline for rows, visible selection and move candidates while retaining the inspector',()=>{
 const navigation=createNavigationModel(),catalogTree=createCatalogTreeModel(),movement=createMovementModel(),treeDrop=createTreeDropModel(),calls=[];
 const snapshot={revision:1,projects:[],tags:[],perspectives:[],list_scopes:{inbox:[parent,child,other]},actions:[
  {id:parent,title:'Parent Alpha',notes:'',status:'active',order:0,flagged:false,revision:1,parent_id:null,project_id:null,tags:[],due_at:null,defer_until:null},
  {id:child,title:'Ａbc child',notes:'saved note',status:'completed',order:0,flagged:false,revision:1,parent_id:parent,project_id:null,tags:[],due_at:null,defer_until:null},
 {id:other,title:'Other',notes:'other note',status:'dropped',order:1,flagged:false,revision:1,parent_id:null,project_id:null,tags:[],due_at:null,defer_until:null},
 ]};
 const controller=createUiController({instanceId:'search-test',call:async(name,args)=>{calls.push({name,args});return structuredClone(snapshot);},ids:{next:()=> 'operation'},model:{...drafts,...operations,autosave:createAutosaveModel(),transient:createTransientModel(),catalogDrafts:createCatalogDraftModel(),navigation,catalogTree,movement,treeDrop,outline:createOutlineModel(navigation,catalogTree)},view:{render(){},message(){},review(){},closeReview(){}}});
 controller.accept(snapshot);controller.editDraft(child,{title:'Draft title',notes:'Draft Search Phrase'});
 const local=controller.createEmpty({title:'',notes:''});controller.editDraft(local,{notes:'Local Note'});controller.selectAction(child);
 const callsBeforeSearch=calls.length;controller.dispatch({type:'search.open'});assert.deepEqual(controller.state.outline.entries,[]);assert.equal(calls.length,callsBeforeSearch,'opening Search does not read or write');
 controller.dispatch({type:'search.query',query:'  draft search phrase  '});
 let projection=controller.state.outline;assert.deepEqual(projection.entries.map(entry=>entry.id),[child]);assert.equal(projection.entries[0].action.title,'Draft title');assert.equal(projection.entries[0].action.notes,'Draft Search Phrase');assert.equal(controller.state.interaction.view.moveDestination,child);
 controller.dispatch({type:'occurrence.range',key:child,range:false,toggle:false,additive:false,entries:projection.entries.map(entry=>({key:entry.key,id:entry.id,kind:entry.kind,catalogId:entry.catalogId}))});
 const searchContext=controller.getSelectionContext();assert.deepEqual(searchContext.view,{kind:'search',classificationId:null,perspectiveId:null});assert.deepEqual(searchContext.selected.map(item=>item.id),[child]);assert.equal(JSON.stringify(searchContext).includes('draft search phrase'),false);
 controller.dispatch({type:'search.query',query:'local note'});projection=controller.state.outline;assert.deepEqual(projection.entries.map(entry=>entry.id),[local]);assert.equal(projection.entries[0].action.title,'');assert.equal(projection.entries[0].action.notes,'Local Note');assert.equal(controller.state.interaction.view.moveDestination,local);
 controller.dispatch({type:'search.query',query:'no match'});assert.deepEqual(controller.state.outline.entries,[]);assert.deepEqual(controller.state.interaction.selection.keys,[]);assert.equal(controller.state.selectedId,child);assert.equal(controller.state.inspector.id,child);assert.equal(controller.state.drafts[child].notes,'Draft Search Phrase');assert.equal(controller.state.drafts[local].title,'');assert.equal(controller.state.drafts[local].notes,'Local Note');assert.equal(controller.state.interaction.view.moveDestination,'');assert.equal(calls.length,callsBeforeSearch,'search queries do not read or write');
 const cached=controller.state.outline,index=movement.index(snapshot.actions),context={actions:snapshot.actions,projects:[],tags:[],index,projectIndex:treeDrop.index([]),tagIndex:treeDrop.index([])};
 controller.dispatch({type:'gesture.context',context});controller.dispatch({type:'gesture.begin',kind:'action',keys:[child],ids:[child]});controller.dispatch({type:'gesture.activate'});
 assert.equal(controller.state.outline,cached,'gesture-only publication should reuse the readonly outline');assert.equal(calls.length,callsBeforeSearch);
});
