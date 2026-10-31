import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogTreeModel} from '../../lib/ui/model/catalog-tree.ts';
import {createNavigationModel} from '../../lib/ui/model/navigation.ts';
import {createOutlineModel} from '../../lib/ui/model/outline.ts';
import {projectActionRow} from '../../lib/ui/model/ui-projections.ts';

const navigation=createNavigationModel(),catalogTree=createCatalogTreeModel(),outline=createOutlineModel(navigation,catalogTree);
const actions=[
 {id:'parent',title:'Alpha parent',notes:'',status:'active',order:0,parent_id:null,project_id:'work',project_path:'Work',tags:[],flagged:false},
 {id:'child',title:'Ａlpha child',notes:'Mixed CASE notes',status:'completed',order:0,parent_id:'parent',project_id:'work',project_path:'Work',tags:[],flagged:false,is_deferred:true},
 {id:'dropped',title:'Dropped',notes:'needle in notes',status:'dropped',order:1,parent_id:null,project_id:null,tags:[],flagged:false},
 {id:'held',title:'On hold',notes:'',metadata:'needle',status:'on-hold',order:2,parent_id:null,project_id:null,tags:[],flagged:false,updated_by:{client_name:'needle'}},
 {id:'local:action:1',title:'',notes:'Local Note proposal',status:'active',order:Number.MAX_SAFE_INTEGER,parent_id:null,project_id:null,tags:[],flagged:false},
 {id:'cross-field',title:'hel',notes:'lo',status:'active',order:3,parent_id:null,project_id:null,tags:[],flagged:false},
 {id:'punctuation',title:'Punctuation a.b [x]',notes:'',status:'active',order:4,parent_id:null,project_id:null,tags:[],flagged:false},
].map(action=>({...action,is_deferred:action.is_deferred??false}));
const snapshot={revision:1,actions,projects:[{id:'work',name:'Work',order:0,parent_id:null}],tags:[],perspectives:[],list_scopes:{inbox:actions.map(action=>action.id)}};
const project=(query,settings={},source=snapshot)=>outline.project({snapshot:source,navigation:{...navigation.initial('search'),searchQuery:query,...settings}});

test('global Search matches normalized literal Title or Notes and applies status/defer display options',()=>{
 const before=structuredClone(snapshot),result=project('  alpha  ');
 assert.equal(result.tree,false);assert.equal(result.flat,true);
 assert.deepEqual(result.entries.map(entry=>entry.id),['parent'],'default Search includes active/on-hold and excludes completed or deferred actions');
 const all=project('alpha',{statuses:['active','completed'],includeDeferred:true});assert.deepEqual(all.entries.map(entry=>entry.id),['parent','child']);
 assert.deepEqual(all.entries.map(entry=>entry.level),[0,0]);assert.deepEqual(all.entries.map(entry=>entry.parentKey),[null,null]);
 assert.equal(all.entries[1].action.status,'completed');assert.equal(all.entries[1].action.is_deferred,true);
 const searchSnapshot={...snapshot,actions:[...snapshot.actions,
  {id:'active-match',title:'needle active',notes:'',status:'active',order:5,parent_id:null,project_id:null,tags:[],flagged:false,is_deferred:false},
  {id:'held-match',title:'needle waiting',notes:'',status:'on-hold',order:6,parent_id:null,project_id:null,tags:[],flagged:false,is_deferred:false},
  {id:'deferred-match',title:'needle later',notes:'',status:'active',order:7,parent_id:null,project_id:null,tags:[],flagged:false,is_deferred:true},
  {id:'completed-match',title:'needle done',notes:'',status:'completed',order:8,parent_id:null,project_id:null,tags:[],flagged:false,is_deferred:false},
 ]};
 assert.deepEqual(project('needle',{},searchSnapshot).entries.map(entry=>entry.id),['active-match','held-match']);
 assert.deepEqual(project('needle',{statuses:['active','on-hold','completed']},searchSnapshot).entries.map(entry=>entry.id),['active-match','held-match','completed-match']);
 assert.deepEqual(project('needle',{statuses:['active'],includeDeferred:true},searchSnapshot).entries.map(entry=>entry.id),['active-match','deferred-match']);
 assert.deepEqual(project('needle',{statuses:['on-hold','completed'],includeDeferred:true},searchSnapshot).entries.map(entry=>entry.id),['held-match','completed-match']);
 assert.deepEqual(project('needle',{statuses:['dropped'],includeDeferred:true},searchSnapshot).entries.map(entry=>entry.id),['dropped']);
 assert.deepEqual(navigation.displayOptions(navigation.initial('search')),['active','on-hold','completed','dropped','deferred']);
 assert.deepEqual(snapshot,before);
});

test('search matches Notes-only and invalid local proposals, excludes metadata and cross-field hits, and deduplicates IDs',()=>{
 const duplicated=[...actions,{...actions[2],title:'needle duplicate'}],input={...snapshot,actions:duplicated},result=outline.project({snapshot:input,navigation:{...navigation.initial('search'),searchQuery:'needle',statuses:['dropped']}});
 assert.deepEqual(result.entries.map(entry=>entry.id),['dropped']);
 const local=project(' local note ');assert.deepEqual(local.entries.map(entry=>entry.id),['local:action:1']);
 assert.deepEqual(project('hello').entries,[]);
 assert.deepEqual(project('not a title').entries,[]);
});

test('search preserves punctuation literally, trims query edges and never inserts a nonmatching parent or reveal row',()=>{
 assert.deepEqual(project(' [x] ').entries.map(entry=>entry.id),['punctuation']);
 const input={...snapshot,actions:actions.map(action=>action.id==='child'?{...action,title:'Hidden child'}:action)};
 const search=outline.project({snapshot:input,navigation:{...navigation.initial('search'),searchQuery:'needle',statuses:['dropped']},creationReveal:{id:'parent',view:'search'}});
 assert.deepEqual(search.entries.map(entry=>entry.id),['dropped']);
 assert.equal(project('   ').entries.length,0);
});

test('matching rows keep their parent context even when the parent is another flat result',()=>{
 const projected=project('alpha',{statuses:['active','completed'],includeDeferred:true}),parent=projected.entries[0].action,child=projected.entries[1].action;
 const row=projectActionRow({entry:projected.entries[1],action:child,actions:projected.entries.map(entry=>entry.action),tree:false,flat:projected.flat,visibleActionIds:projected.entries.map(entry=>entry.id),batchSelected:false,active:false,formattedDue:''});
 assert.deepEqual(row.badges,[{icon:'completed',iconOnly:true,text:'Done'},{text:'In '+parent.title,tone:'muted'},{text:'Work',tone:'muted'}]);
});

test('one outline projection preserves catalog tree and confirmed Perspective semantics',()=>{
 const tree=outline.project({snapshot,navigation:{...navigation.initial(),view:'projects',classificationId:'work'},collapsed:[]});
 assert.equal(tree.tree,true);assert.deepEqual(tree.entries.map(entry=>entry.key),['project:work','project:work:action:parent','project:none','project:none:action:held','project:none:action:local:action:1','project:none:action:cross-field','project:none:action:punctuation']);
 const confirmed={...snapshot,actions:actions.filter(action=>action.id!=='local:action:1'),perspectives:[{id:'saved',name:'Saved',definition_version:1,filter:{}}]};
 const overlay={...snapshot,actions:actions.map(action=>({...action,title:'Changed locally'})),perspectives:confirmed.perspectives};
 const perspective=outline.project({snapshot:overlay,confirmedSnapshot:confirmed,navigation:{...navigation.initial(),view:'perspective',perspectiveId:'saved'}});
 assert.deepEqual(perspective.entries.map(entry=>entry.id),['parent','child','dropped','held','cross-field','punctuation']);assert.equal(perspective.entries[0].action.title,'Alpha parent');
});
