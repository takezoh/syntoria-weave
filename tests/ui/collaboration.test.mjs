import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createUiController} from '../../lib/ui/application/controller.ts';
import {createAutosaveModel} from '../../lib/ui/model/autosave.ts';
import * as drafts from '../../lib/ui/model/drafts.ts';
import * as operations from '../../lib/ui/model/operations.ts';
import {createCollaboration,transitionCollaboration} from '../../lib/domain/collaboration.ts';
import {projectCollaborations,collaborationLabel,actionCollaborationStatus,collaborationStatusKind} from '../../lib/ui/model/collaboration.ts';
import {createRichTextCache} from '../../lib/ui/model/rich-text.ts';
import {projectActionRow} from '../../lib/ui/model/ui-projections.ts';
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
 panel.render(projectCollaborations(c.state));const field=root.querySelector('[aria-label="Changes or response"]');field.value='Keep this';field.dispatchEvent(new dom.window.Event('input'));assert.deepEqual(events[0],[id(2),'Keep this']);c.editCollaboration(id(2),'Keep this');panel.render(projectCollaborations(c.state));assert.equal(root.querySelector('[aria-label="Changes or response"]'),field);const excluded=[...root.querySelectorAll('.collaboration-fields > div')].find(row=>row.querySelector('dt').textContent==='Excluded');assert.equal(excluded.hidden,false);assert.equal(excluded.querySelector('dd').textContent,'Do not send');
 assert.equal(root.querySelector('[data-command="reject"]'),null);assert.match(root.textContent,/Edit proposal/);
 const next=snapshot();next.collaborations=[{...next.collaborations[0],action_id:null}];c.accept(next);panel.render(projectCollaborations(c.state,true));assert(root.querySelector('[data-command="adopt"]'));assert(root.querySelector('[data-command="adopt_delegate"]'));assert(root.querySelector('[data-command="link"]'));
});
test('each Action row shows the most urgent collaboration status as one named icon, muted once the Action is closed',()=>{
 const s=snapshot(),base=s.collaborations[0],running={...base,decision:'accepted',progress:'running',run_id:id(30),run_actor:actor},kinds=[
  [{...running,stop_requested:true},'alert'],[{...base,decision:'accepted',progress:'reported',outcome:'unknown'},'alert'],[{...running,progress:'waiting',next_actor:'user'},'reply'],[{...base,decision:'accepted',progress:'reported',outcome:'success'},'result'],
  [base,'proposal'],[running,'running'],[{...base,decision:'accepted'},'requested'],[{...running,progress:'waiting',next_actor:'external'},'external'],[{...base,decision:'changes_requested'},'revising'],
  [{...base,decision:'deferred'},'deferred'],[{...running,decision:'accepted',progress:'stopped'},'stopped'],[{...base,decision:'rejected'},'declined'],[{...base,decision:'withdrawn'},'declined']];
 for(const [record,kind] of kinds)assert.equal(collaborationStatusKind(record),kind,kind);
 const records=[{...base,decision:'deferred'},{...base,id:id(5)},{...base,id:id(6)},{...base,id:id(7),action_id:id(11),decision:'accepted',progress:'waiting',next_actor:'user',run_id:id(31),run_actor:actor}],before=structuredClone(records);
 assert.deepEqual(actionCollaborationStatus(records,id(1),'active'),{kind:'proposal',icon:'proposal',tone:'accent',label:'2 proposals to review'});
 assert.deepEqual(actionCollaborationStatus(records,id(11),'active'),{kind:'reply',icon:'reply',tone:'attention',label:'Your response is needed'});
 assert.equal(actionCollaborationStatus(records,id(11),'completed').tone,'muted','a closed Action never asks for attention');
 assert.equal(actionCollaborationStatus(records,id(13),'active'),null);assert.equal(actionCollaborationStatus(null,id(1)),null);assert.deepEqual(records,before);
 const input={entry:{key:id(1),level:0},action:s.actions[0],actions:s.actions,tree:false,visibleActionIds:[id(1)],batchSelected:false,active:false,formattedDue:''};
 const status=actionCollaborationStatus(records,id(1),'active');
 assert.deepEqual(projectActionRow({...input,collaboration:status}).badges[0],{text:'2 proposals to review',icon:'proposal',tone:'accent',iconOnly:true});
 assert.deepEqual(projectActionRow(input).badges,[]);assert.notEqual(projectActionRow({...input,collaboration:status}).signature,projectActionRow(input).signature);
});

test('the Collaboration view lists Actions with collaboration records, shows their status icon and approves from the details with an ordinary exact-revision write',async t=>{
 let current={...snapshot(),list_scopes:{inbox:[id(1)]}};const calls=[];const dom=new JSDOM(widgetHtml,{url:'https://app.example.test',runScripts:'dangerously',beforeParse(w){w.postMessage=message=>{if(!message.id)return;let result={};if(message.method==='tools/call'){const {name,arguments:args}=message.params;calls.push({name,args:structuredClone(args)});if(name==='update_collaboration'){const changed=transitionCollaboration(current,current.collaborations[0],args.command,args.payload,actor,now);current={...current,revision:current.revision+1,collaborations:[changed],result:{operationId:args.operationId,collaboration_id:id(2)}};}result={structuredContent:current};}queueMicrotask(()=>w.dispatchEvent(new w.MessageEvent('message',{source:w,data:{jsonrpc:'2.0',id:message.id,result}})));};}});t.after(()=>dom.window.close());
 const settle=async()=>{for(let i=0;i<30;i++)await new Promise(resolve=>setImmediate(resolve));};await settle();const d=dom.window.document;
 assert.equal(d.getElementById('collaborationOverview'),null);const row=()=>d.querySelector('.action-row[data-action-id="'+id(1)+'"]');
 d.querySelector('#viewRail [data-view="inbox"]').click();await settle();const badge=()=>row().querySelector('.badge.icon-only');assert.equal(badge().title,'Proposal to review');assert(badge().classList.contains('accent'));assert.equal(d.querySelector('[data-rail-count="collaboration"]').textContent,'1 waiting on you');assert.equal(d.querySelector('[data-rail-count="collaboration"]').dataset.badge,'true');assert.equal(d.title,'(1) Inbox');
 d.querySelector('#viewRail [data-view="collaboration"]').click();await settle();assert.equal(d.getElementById('scopeTitle').textContent,'Collaboration');assert.deepEqual([...d.querySelectorAll('.action-row')].map(item=>item.dataset.actionId),[id(1)]);assert.equal(d.getElementById('collaborationSuggestions').hidden,true,'no unlinked suggestions');
 row().querySelector('.action-select').click();await settle();d.querySelector('#collaborationPanel [data-command="accept"]').click();await settle();
 assert.equal(calls.filter(row=>row.name==='update_collaboration').length,1);assert.equal(calls.find(row=>row.name==='update_collaboration').args.payload.version,1);assert.equal(current.actions[0].status,'active');
 assert.equal(badge().title,'Requested — not started');assert.equal(badge().querySelector('svg path')?.getAttribute('d'),'M12 7v5l3 2','an approved request shows the waiting-to-start clock');
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

test('cards show the delegation target in its selector and who started the work, and changing the target sends one assign event',async t=>{
 const calls=[];const {c}=fixture(async(name,args)=>{calls.push({name,args:structuredClone(args)});const s=snapshot();return {...s,revision:2,clients:[{client_id:'claude-client',name:'Claude'}],result:{operationId:args.operationId,collaboration_id:id(2)},collaborations:[{...s.collaborations[0],delegation:args.payload.delegation,revision:2}]};});
 const s=snapshot();c.accept({...s,clients:[{client_id:'claude-client',name:'Claude'}]});
 const dom=new JSDOM('<main></main>');t.after(()=>dom.window.close());const d=dom.window.document,root=d.querySelector('main');
 const panel=createCollaborationPanel(d,root,{toggle(){},edit(){},request(){},command(){},history(){},copy(){},open(){},assign:(key,delegation)=>c.assignCollaboration(key,delegation)});
 panel.render(projectCollaborations(c.state));
 assert.equal(root.querySelector('.collaboration-handler').hidden,true);
 const select=root.querySelector('select:not([aria-label="Verified outcome"])');assert.deepEqual([...select.options].map(option=>option.textContent),['Any AI','Claude']);assert.equal(select.value,'0');
 select.value='1';select.dispatchEvent(new dom.window.Event('change'));await new Promise(resolve=>setImmediate(resolve));
 const sent=calls.filter(row=>row.name==='update_collaboration');assert.equal(sent.length,1);assert.equal(sent[0].args.command,'assign');assert.deepEqual(sent[0].args.payload,{version:1,delegation:{mode:'specified_ai',client_id:'claude-client'}});
 panel.render(projectCollaborations(c.state));assert.equal(root.querySelector('select:not([aria-label="Verified outcome"])').value,'1');assert.equal(root.querySelector('.collaboration-handler').hidden,true);
 const accepted=transitionCollaboration(snapshot(),c.state.data.collaborations[0],'accept',{version:1},actor,now),running=transitionCollaboration(snapshot(),accepted,'start',{version:1},actor,now,id(9));
 c.accept({...snapshot(),revision:3,clients:[{client_id:'claude-client',name:'Claude'}],collaborations:[running]});panel.render(projectCollaborations(c.state));
 assert.match(root.querySelector('.collaboration-handler').textContent,/^Started by AI connection example-/);assert.equal(root.querySelector('.collaboration-handler').hidden,false);
 assert.deepEqual([...root.querySelector('select:not([aria-label="Verified outcome"])').options].map(option=>option.textContent),['Any AI','Claude','AI connection example-']);
});

test('cards render proposal and report text as Markdown, hide empty fields and place each decision in its slot',t=>{
 const dom=new JSDOM('<main></main>');t.after(()=>dom.window.close());const d=dom.window.document,root=d.querySelector('main'),opened=[];
 const {c}=fixture(async()=>{});const base=snapshot().collaborations[0];
 c.accept({...snapshot(),revision:2,collaborations:[{...base,proposal:{...proposal,instructions:'**Draft** the reply\n\n- Check [notes](https://example.com/notes)\n- Keep it short',exclusions:''},summary:'### Done\n- Read the thread'}]});
 const before=structuredClone(c.state.data.collaborations),cache=createRichTextCache();
 const panel=createCollaborationPanel(d,root,{toggle(){},edit(){},request(){},command(){},history(){},copy(){},open:href=>opened.push(href)},name=>`<svg data-icon="${name}"></svg>`);
 panel.render(projectCollaborations(c.state,false,false,cache));assert.deepEqual(c.state.data.collaborations,before);
 const body=root.querySelector('.collaboration-text');assert.equal(body.querySelector('strong').textContent,'Draft');assert.equal(body.querySelectorAll('li').length,2);assert.equal(body.querySelector('a')?.textContent,'notes');assert.equal(body.textContent.includes('**'),false,'Markdown syntax is rendered, not shown');
 const row=label=>[...root.querySelectorAll('.collaboration-fields > div')].find(item=>item.querySelector('dt').textContent===label);
 assert.equal(row('Excluded').hidden,true,'an empty field has no row');assert.equal(row('Scope').hidden,false);assert.equal(row('Scope').querySelector('dd').textContent,'Draft only');
 assert.equal(root.querySelector('.collaboration-report').hidden,false);assert.match(root.querySelector('.collaboration-report').textContent,/Done/);assert.equal(root.querySelector('.collaboration-report').textContent.includes('###'),false);
 const approve=root.querySelector('[data-command="accept"]');assert.equal(approve.textContent,'Approve');assert.equal(approve.getAttribute('aria-label'),'Approve this proposal');assert(approve.closest('.collaboration-row'));
 const revise=root.querySelector('[data-command="request_changes"]');assert(revise.closest('.collaboration-composer'));assert(revise.querySelector('svg[data-icon="send"]'));assert.equal(revise.textContent,'Ask AI to revise');assert.equal(revise.disabled,true);
 for(const label of ['Edit proposal','Copy request for AI','Show recent history']){const button=[...root.querySelectorAll('.collaboration-tools button')].find(item=>item.textContent===label);assert(button,label);assert.equal(button.title,label);assert(button.querySelector('svg'));}
 const node=body.firstChild;panel.render(projectCollaborations(c.state,false,false,cache));assert.equal(root.querySelector('.collaboration-text').firstChild,node,'unchanged text keeps its nodes');
});

test('caller metadata never reaches the card, its text content or the copied request',t=>{
 const dom=new JSDOM('<main></main>');t.after(()=>dom.window.close());const d=dom.window.document,root=d.querySelector('main'),copied=[];
 const {c}=fixture(async()=>{});const secret='step: fill-form · checked: 4 · retry-token';
 c.accept({...snapshot(),revision:2,collaborations:[{...snapshot().collaborations[0],metadata:secret}]});
 const panel=createCollaborationPanel(d,root,{toggle(){},edit(){},request(){},command(){},history(){},copy:value=>copied.push(value),open(){}});
 const data=projectCollaborations(c.state);panel.render(data);
 assert.equal(c.state.data.collaborations[0].metadata,secret,'the snapshot keeps it for callers');
 assert.equal(root.textContent.includes(secret),false);assert.equal(root.innerHTML.includes('retry-token'),false);
 assert.equal(JSON.stringify(data.cards[0].text).includes('retry-token'),false);
 [...root.querySelectorAll('button')].find(button=>button.textContent==='Copy request for AI').click();
 assert.equal(copied.length,1);assert.equal(copied[0].includes('retry-token'),false,'the handoff points to get_collaboration instead');
});

test('suggested work without an Action appears above the Collaboration list only, with its adoption choices',async t=>{
 const base=snapshot(),current={...base,list_scopes:{inbox:[id(1)]},collaborations:[{...base.collaborations[0],action_id:null,action_revision:null}]};
 const dom=new JSDOM(widgetHtml,{url:'https://app.example.test',runScripts:'dangerously',beforeParse(w){w.postMessage=message=>{if(!message.id)return;const result=message.method==='tools/call'?{structuredContent:current}:{};queueMicrotask(()=>w.dispatchEvent(new w.MessageEvent('message',{source:w,data:{jsonrpc:'2.0',id:message.id,result}})));};}});t.after(()=>dom.window.close());
 const settle=async()=>{for(let i=0;i<30;i++)await new Promise(resolve=>setImmediate(resolve));};await settle();const d=dom.window.document,section=d.getElementById('collaborationSuggestions');
 assert.equal(section.hidden,true,'the landing Inbox shows no suggestions');assert.equal(d.querySelector('[data-rail-count="collaboration"]').textContent,'1 waiting on you');
 d.querySelector('#viewRail [data-view="collaboration"]').click();await settle();
 assert.equal(section.hidden,false);assert.match(section.textContent,/New work suggestion/);assert.deepEqual([...section.querySelectorAll('[data-command]')].map(button=>button.dataset.command).filter(command=>command.startsWith('adopt')),['adopt','adopt_delegate']);
 assert.equal(d.querySelectorAll('.action-row').length,0,'the record names no Action, so the list stays empty');
 d.querySelector('#viewRail [data-view="flagged"]').click();await settle();assert.equal(section.hidden,true);
});
