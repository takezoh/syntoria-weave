import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createUiController} from '../../lib/ui/application/controller.ts';
import {createAutosaveModel} from '../../lib/ui/model/autosave.ts';
import * as drafts from '../../lib/ui/model/drafts.ts';
import * as operations from '../../lib/ui/model/operations.ts';
import {createCollaboration,transitionCollaboration} from '../../lib/domain/collaboration.ts';
import {projectCollaborations,collaborationLabel} from '../../lib/ui/model/collaboration.ts';
import {createCollaborationPanel} from '../../lib/ui/components/collaboration-panel.ts';
import {widgetHtml} from '../../lib/widget.ts';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now='2026-10-29T12:00:00.000Z',actor={kind:'client',client_id:'example-client',connection_id:'connection-a'};
const proposal={title:'Draft reply',instructions:'Original request',scope:'Draft only',outcome:'Draft and references',exclusions:'Do not send',source:'Conversation'};
function snapshot(){const s={schemaVersion:2,collaboration_version:1,revision:1,projects:[],tags:[],perspectives:[],actions:[{id:id(1),title:'Reply',notes:'',revision:1,status:'active',parent_id:null,project_id:null,order:0,flagged:false,due_at:null,defer_until:null,created_at:now,updated_at:now}],collaborations:[]};return {...s,collaborations:[createCollaboration(s,id(2),id(1),proposal,now)]};}
function fixture(call){let count=20;const messages=[];const c=createUiController({call,ids:{next:()=>id(count++)},instanceId:'test',model:{...drafts,...operations,autosave:createAutosaveModel()},view:{render(){},message(value){messages.push(value);},review(){},closeReview(){}}});c.accept(snapshot());c.selectAction(id(1));return {c,messages};}
test('collaboration writes preserve exact unknown requests and newer feedback through receipt recovery',async()=>{
 const calls=[];let saved;
 const {c}=fixture(async(name,args)=>{calls.push({name,args:structuredClone(args)});if(name==='update_collaboration'){saved={...snapshot(),revision:2,result:{operationId:args.operationId,collaboration_id:id(2)},collaborations:[{...snapshot().collaborations[0],decision:'changes_requested'}]};throw Object.assign(Error('lost'),{code:'outcome_unknown'});}if(name==='operation_status')return {status:'applied',result:saved.result};return saved;});
 c.editCollaboration(id(2),'Use meeting notes only');await c.decideCollaboration(id(2),'request_changes');
 assert.equal(c.state.unknown.args.payload.feedback,'Use meeting notes only');c.editCollaboration(id(2),'Newer instruction');c.editDraft(id(1),{notes:'Unsent action note'});
 await c.check();assert.equal(c.state.unknown,null);assert.equal(c.state.collaborationDrafts[id(2)],'Newer instruction');assert.equal(c.state.drafts[id(1)].notes,'Unsent action note');assert.equal(c.state.lastOperation,null);assert.equal(calls.filter(row=>row.name==='update_collaboration').length,1);
});
test('conflicts retain feedback, and a partial collaboration snapshot cannot erase it',async()=>{
 const {c}=fixture(async()=>{throw Object.assign(Error('Changed proposal'),{code:'conflict'});});c.editCollaboration(id(2),'Keep this');await c.decideCollaboration(id(2),'request_changes');assert.equal(c.state.collaborationDrafts[id(2)],'Keep this');assert.equal(c.state.unknown,null);
 assert.equal(c.accept({...snapshot(),revision:5,collaborations:undefined}),false);assert.equal(c.state.data.revision,1);
});
test('labels distinguish waiting for start, waiting for a person, stop request and unknown outcomes',()=>{
 const original=snapshot().collaborations[0],accepted=transitionCollaboration(snapshot(),original,'accept',{version:1},actor,now);
 assert.match(collaborationLabel(accepted),/not started/);const running=transitionCollaboration(snapshot(),accepted,'start',{version:1},actor,now,id(3));
 assert.match(collaborationLabel({...running,stop_requested:true}),/awaiting confirmation/);assert.match(collaborationLabel({...running,progress:'reported',outcome:'unknown'}),/verify before retrying/);
});
test('component preserves editor nodes and exposes explicit scope, direct editing and separate adoption actions',t=>{
 const dom=new JSDOM('<main></main>');t.after(()=>dom.window.close());const document=dom.window.document,root=document.querySelector('main'),events=[];
 const {c}=fixture(async()=>{});const panel=createCollaborationPanel(document,root,{toggle(){},edit:(...args)=>events.push(args),request(){},command:(...args)=>events.push(args),history(){},copy(){},open(){}});
 panel.render(projectCollaborations(c.state));const field=root.querySelector('[aria-label="Changes or response"]');field.value='Keep this';field.dispatchEvent(new dom.window.Event('input'));assert.deepEqual(events[0],[id(2),'Keep this']);c.editCollaboration(id(2),'Keep this');panel.render(projectCollaborations(c.state));assert.equal(root.querySelector('[aria-label="Changes or response"]'),field);assert.match(root.textContent,/Excluded: Do not send/);
 assert.equal(root.querySelector('[data-command="reject"]'),null);assert.match(root.textContent,/Edit proposal/);
 const next=snapshot();next.collaborations=[{...next.collaborations[0],action_id:null}];c.accept(next);panel.render(projectCollaborations(c.state,true));assert(root.querySelector('[data-command="adopt"]'));assert(root.querySelector('[data-command="adopt_delegate"]'));assert(root.querySelector('[data-command="link"]'));
});
test('generated widget connects review controls to ordinary exact-revision collaboration writes',async t=>{
 let current=snapshot();const calls=[];const dom=new JSDOM(widgetHtml,{url:'https://app.example.test',runScripts:'dangerously',beforeParse(w){w.postMessage=message=>{if(!message.id)return;let result={};if(message.method==='tools/call'){const {name,arguments:args}=message.params;calls.push({name,args:structuredClone(args)});if(name==='update_collaboration'){const changed=transitionCollaboration(current,current.collaborations[0],args.command,args.payload,actor,now);current={...current,revision:current.revision+1,collaborations:[changed],result:{operationId:args.operationId,collaboration_id:id(2)}};}result={structuredContent:current};}queueMicrotask(()=>w.dispatchEvent(new w.MessageEvent('message',{source:w,data:{jsonrpc:'2.0',id:message.id,result}})));};}});t.after(()=>dom.window.close());
 const settle=async()=>{for(let i=0;i<30;i++)await new Promise(resolve=>setImmediate(resolve));};await settle();const d=dom.window.document;
 d.getElementById('collaborationOverview').open=true;d.querySelector('#collaborationReview [data-command="accept"]').click();await settle();
 assert.equal(calls.filter(row=>row.name==='update_collaboration').length,1);assert.equal(calls.find(row=>row.name==='update_collaboration').args.payload.version,1);assert.match(d.querySelector('#collaborationReview').textContent,/Requested — not started/);assert.equal(current.actions[0].status,'active');
});

test('three proposal choices remain visible after approval cancellation and edited drafts survive remote revisions',async()=>{
 const calls=[];const {c}=fixture(async(name,args)=>{calls.push({name,args});throw Object.assign(Error('Changed remotely'),{code:'conflict'});});
 const s=snapshot(),first=s.collaborations[0];s.collaborations=[first,{...first,id:id(3),decision:'accepted'},{...first,id:id(4),decision:'withdrawn'}];c.accept(s);
 let view=projectCollaborations(c.state);assert.equal(view.cards.length,3);assert.equal(view.requestDisabled,true);assert.equal(view.cards[0].buttons.some(b=>b.command==='accept'),false);assert(view.cards[1].buttons.some(b=>b.command==='withdraw'));assert(view.cards.every(card=>card.buttons.every(b=>b.command!=='reject')));
 c.beginProposalEdit(id(2));c.editProposalField(id(2),'scope','User edited scope');
 const refreshed={...s,revision:2,collaborations:s.collaborations.map(row=>row.id===id(2)?{...row,version:2,proposal:{...row.proposal,scope:'AI correction'}}:row)};c.accept(refreshed);
 assert.equal(c.state.collaborationEdits[id(2)].proposal.scope,'User edited scope');await c.saveProposalEdit(id(2));assert.equal(calls[0].args.payload.version,1);assert.equal(c.state.collaborationEdits[id(2)].proposal.scope,'User edited scope');
 c.cancelProposalEdit(id(2));assert.equal(c.state.collaborationEdits[id(2)],undefined);
});

test('proposal editing DOM retains fields and dispatches save without approving',t=>{
 const dom=new JSDOM('<main></main>');t.after(()=>dom.window.close());const d=dom.window.document,root=d.querySelector('main');const {c}=fixture(async()=>{}),events=[];
 const panel=createCollaborationPanel(d,root,{toggle(){},edit(){},request(){},command(){},history(){},copy(){},open(){},beginEdit:id=>c.beginProposalEdit(id),editField:(...args)=>c.editProposalField(...args),saveEdit:id=>events.push(id),cancelEdit:id=>c.cancelProposalEdit(id)});
 panel.render(projectCollaborations(c.state));[...root.querySelectorAll('button')].find(b=>b.textContent==='Edit proposal').click();panel.render(projectCollaborations(c.state));
 const field=root.querySelector('[aria-label="Proposal scope"]');field.value='Only prepare notes';field.dispatchEvent(new dom.window.Event('input'));panel.render(projectCollaborations(c.state));assert.equal(root.querySelector('[aria-label="Proposal scope"]'),field);assert.equal(c.state.collaborationEdits[id(2)].proposal.scope,'Only prepare notes');assert.equal(root.querySelector('[data-command="accept"]'),null);
 [...root.querySelectorAll('button')].find(b=>b.textContent==='Save proposal changes').click();assert.deepEqual(events,[id(2)]);
});
