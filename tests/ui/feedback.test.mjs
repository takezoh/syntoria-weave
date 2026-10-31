import test from 'node:test';
import assert from 'node:assert/strict';
import {createUiController} from '../../lib/ui/application/controller.ts';
import {projectFeedback} from '../../lib/ui/model/feedback.ts';
import * as drafts from '../../lib/ui/model/drafts.ts';
import * as operations from '../../lib/ui/model/operations.ts';
import {createAutosaveModel} from '../../lib/ui/model/autosave.ts';
import {createCatalogDraftModel} from '../../lib/ui/model/catalog-drafts.ts';
const wide={mode:'wide',page:'list',listVisible:true};
function fixture(){
 let sequence=0,readError=false,writeError=null,hold=null;const calls=[];
 const snapshot={revision:1,actions:[{id:'a',title:'Action',notes:'',order:0,flagged:false,status:'active',defer_until:null,parent_id:null,due_at:null,revision:1}],projects:[{id:'p',name:'Project',description:'',parent_id:null,order:0}],tags:[],perspectives:[]};
 const controller=createUiController({instanceId:'test',ids:{next:()=>String(++sequence)},model:{...drafts,...operations,autosave:createAutosaveModel(),catalogDrafts:createCatalogDraftModel(),formatDateTime:value=>value},view:{render(){},message(){},review(){},closeReview(){}},call:async(name,args)=>{calls.push({name,args:structuredClone(args)});if(name==='list_actions'){if(readError)throw Error('offline');return structuredClone(snapshot);}if(hold)await hold;if(writeError)throw Object.assign(Error(writeError),{code:writeError});snapshot.revision++;return {...structuredClone(snapshot),result:{operationId:args.operationId||args.request_id}};}});
 return {controller,calls,snapshot,failRead(value){readError=value;},failWrite(value){writeError=value;},hold(value){hold=value;}};
}
test('read failures, retained action and catalog drafts and Undo have independent provenance',async()=>{
 const f=fixture(),c=f.controller;await c.refresh();await c.add('New');const notice=c.state.operationNotice;
 c.editDraft('a',{title:'x'.repeat(201)});c.editCatalog('project:p',{name:'Changed'});
 f.failRead(true);await assert.rejects(c.refresh(),/offline/);let projected=projectFeedback(c.state,wide);
 assert.equal(projected.read.kind,'error');assert.equal(projected.notice.id,notice.id);assert.deepEqual(projected.recovery.map(row=>row.key),['action:a','project:p']);
 assert.match(projected.recovery[0].label,/Needs attention/);assert.match(projected.recovery[1].label,/Unsaved/);
 f.failRead(false);await c.refresh();projected=projectFeedback(c.state,wide);assert.equal(projected.read.kind,'ready');assert.equal(projected.notice.id,notice.id);assert.equal(projected.recovery.length,2);
 const before=JSON.stringify(c.state);projectFeedback(c.state,{mode:'mobile',page:'catalog',listVisible:false});assert.equal(JSON.stringify(c.state),before);
});
test('Undo remains until matching dismissal, replacement or acknowledgment; stale dismissals cannot remove a newer notice',async()=>{
 const f=fixture(),c=f.controller;await c.refresh();await c.add('First');const first=c.state.operationNotice;await c.refresh();assert.equal(c.state.operationNotice.id,first.id);
 await c.add('Second');const second=c.state.operationNotice;assert.notEqual(first.id,second.id);await c.undoNotice(first.id,first.undoOf);assert.equal(f.calls.filter(row=>row.name==='undo_change').length,0,'a deferred stale control cannot undo the newer notice');c.dismissNotice(first.id);assert.equal(c.state.operationNotice.id,second.id);
 c.dismissNotice(second.id);assert.equal(c.state.operationNotice,null);assert.equal(c.state.lastOperation,second.undoOf,'dismissal only clears presentation');
 await c.add('Third');await c.undo();assert.equal(c.state.operationNotice,null);assert.equal(c.state.lastOperation,null);assert.equal(f.calls.at(-1).args.undoOf,'3');
});
test('failed and unknown Undo retain their exact target and are never retried at a new revision implicitly',async()=>{
 const f=fixture(),c=f.controller;await c.refresh();await c.add('First');const notice=c.state.operationNotice;
 let release;f.hold(new Promise(resolve=>{release=resolve;}));f.failWrite('conflict');const undo=c.undo();assert.equal(c.state.pendingUndo,notice.undoOf);assert.equal(projectFeedback(c.state,wide).notice.undoDisabled,true);await c.undo();release();await undo;f.hold(null);
 assert.equal(f.calls.filter(row=>row.name==='undo_change').length,1);assert.equal(c.state.operationNotice.id,notice.id);assert.match(projectFeedback(c.state,wide).failure,/conflict/);
 await c.refresh();assert.equal(c.state.operationNotice.id,notice.id);f.failWrite('outcome_unknown');await c.undo();const retained=structuredClone(c.state.unknown.args);const projection=projectFeedback(c.state,wide);assert.equal(projection.unknown,true);assert.equal(projection.failure,'');assert.equal(projection.advisory,null);
 await c.refresh();assert.deepEqual(c.state.unknown.args,retained);f.failWrite(null);await c.retry();assert.deepEqual(f.calls.at(-1).args,retained);assert.equal(c.state.operationNotice,null);
});
test('notice placement follows target in wide split and the visible page in narrow detail',async()=>{
 const f=fixture(),c=f.controller;await c.refresh();c.notify('verification','Discarded for verification',{kind:'project',id:'p'});c.selectCatalog('project','p');
 assert.equal(projectFeedback(c.state,{mode:'wide',page:'catalog',listVisible:true}).advisory.pane,'catalog');
 c.selectAction('a');assert.equal(projectFeedback(c.state,{mode:'wide',page:'action',listVisible:true}).advisory.pane,'list');assert.equal(projectFeedback(c.state,{mode:'mobile',page:'action',listVisible:false}).advisory.pane,'action');
 c.dismissAdvisory(c.state.advisoryNotice.id);assert.equal(c.state.advisoryNotice,null);
});

test('wide unknown recovery follows its typed target instead of an unrelated inspector',async()=>{
 const f=fixture(),c=f.controller;await c.refresh();c.selectAction('a');const state={...c.state,unknown:{name:'apply_change',args:{operationId:'exact',kind:'project_edit',payload:{id:'p',name:'Mine'}}}};
 const split={mode:'wide',page:'action',listVisible:true};assert.equal(projectFeedback(state,split).unknownPane,'list');
 assert.equal(projectFeedback({...state,inspector:{kind:'project',id:'p'}},{...split,page:'catalog'}).unknownPane,'catalog');
 assert.equal(projectFeedback(state,{mode:'mobile',page:'action',listVisible:false}).unknownPane,'action');
});
