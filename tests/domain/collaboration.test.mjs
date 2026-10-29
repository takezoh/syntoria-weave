import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCollaboration,transitionCollaboration} from '../../lib/domain/collaboration.ts';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now='2026-10-29T12:00:00.000Z';
const actor={kind:'client',client_id:'example-client',connection_id:'connection-a'};
const proposal={title:'Reply',instructions:'  Exact original\nrequest\0\ud800  ',scope:'Draft a reply',outcome:'A draft and sources',exclusions:'Do not send',source:'User conversation'};
const snapshot={revision:2,actions:[{id:id(1),title:'Reply',revision:2,status:'active'}],collaborations:[]};
const created=()=>createCollaboration(snapshot,id(2),id(1),proposal,now);
const move=(record,command,payload={})=>transitionCollaboration(snapshot,record,command,{version:record.version,...payload},actor,now,id(3));
test('proposals preserve original text without mutating human actions or inputs',()=>{
 const before=structuredClone(snapshot),record=created();assert.equal(record.proposal.instructions,proposal.instructions);assert.equal(record.decision,'pending');assert.equal(record.progress,'not_started');assert.deepEqual(snapshot,before);
 assert.equal(createCollaboration({...snapshot,collaborations:[record]},id(4),id(1),proposal,now).decision,'pending');
 assert.equal(createCollaboration(snapshot,id(2),null,proposal,now).action_id,null);
});
test('acceptance is not execution, reports never complete an action, and only the run connection reports',()=>{
 const accepted=move(created(),'accept');assert.equal(accepted.progress,'not_started');assert.equal(accepted.next_actor,'ai');
 const running=move(accepted,'start');assert.equal(running.progress,'running');assert.equal(running.run_id,id(3));
 assert.throws(()=>transitionCollaboration(snapshot,running,'report',{version:1,run_id:id(3),summary:'Sent',outcome:'success',artifacts:[]},{...actor,connection_id:'connection-b'},now),e=>e.code==='conflict');
 const result=move(running,'report',{run_id:id(3),summary:'Draft ready',remaining:'User must send',outcome:'success',artifacts:[]});assert.equal(result.progress,'reported');assert.equal(snapshot.actions[0].status,'active');
});
test('decline, postpone and revision do not change the action; stale decisions fail',()=>{
 const record=created();assert.throws(()=>move(record,'reject'),e=>e.code==='invalid_input');assert.equal(move(record,'defer').decision,'deferred');
 const revised=move(move(record,'request_changes',{feedback:'Use only the meeting notes'}),'revise',{proposal:{...proposal,scope:'Use the meeting notes'}});
 assert.equal(revised.version,2);assert.equal(revised.decision,'pending');assert.throws(()=>move(revised,'accept',{version:1}),e=>e.code==='conflict');assert.equal(snapshot.actions[0].status,'active');
});
test('action edits and completion block start; withdrawal asks for stop and accepts the actual late outcome',()=>{
 const accepted=move(created(),'accept');
 assert.throws(()=>transitionCollaboration({...snapshot,actions:[{...snapshot.actions[0],revision:3}]},accepted,'start',{version:1},actor,now,id(3)),e=>e.code==='conflict');
 assert.throws(()=>transitionCollaboration({...snapshot,actions:[{...snapshot.actions[0],status:'completed'}]},accepted,'start',{version:1},actor,now,id(3)),e=>e.code==='invalid_state');
 const running=move(accepted,'start'),withdrawn=move(running,'withdraw');assert.equal(withdrawn.progress,'running');assert.equal(withdrawn.stop_requested,true);
 const late=move(withdrawn,'report',{run_id:id(3),summary:'The request timed out',remaining:'Check the provider receipt',outcome:'unknown',artifacts:[]});assert.equal(late.outcome,'unknown');assert.equal(late.decision,'pending');
});
test('handoff responses preserve the run and reject implicit execution prerequisites',()=>{
 const running=move(move(created(),'accept'),'start');const waiting=move(running,'wait',{run_id:id(3),summary:'Which draft should I use?',next_actor:'user'});
 const resumed=move(waiting,'respond',{feedback:'Use the first draft'});assert.equal(resumed.next_actor,'ai');assert.equal(resumed.run_id,running.run_id);assert.equal(resumed.feedback,'Use the first draft');
 assert.throws(()=>move(running,'revise',{proposal}),e=>e.code==='invalid_state');assert.throws(()=>move(running,'report',{run_id:id(3),summary:'Done',outcome:'success',artifacts:[{label:'bad',url:'javascript:alert(1)'}]}),e=>e.code==='invalid_input');
});
test('an ended or unknown run cannot be reaccepted through postpone, and unknown reports require reconciliation',()=>{
 const running=move(move(created(),'accept'),'start'),report={run_id:id(3),summary:'Provider timed out',remaining:'Check receipt',outcome:'unknown',artifacts:[]};
 const unknown=move(running,'report',report);
 for(const command of ['defer','accept','request_changes','revise'])assert.throws(()=>move(unknown,command,{feedback:'Try again',proposal}),e=>e.code==='invalid_state');
 const resolved=move(unknown,'report',{...report,summary:'Receipt confirms success',outcome:'success'});assert.equal(resolved.outcome,'success');
 assert.throws(()=>move(resolved,'defer'),e=>e.code==='invalid_state');
 const revision=move(move(resolved,'request_changes',{feedback:'Draft a follow-up'}),'revise',{proposal});assert.equal(revision.version,2);assert.equal(revision.run_id,null);assert.equal(revision.decision,'pending');
});

test('withdrawn unknown outcomes block replacement until an explicit observed reconciliation',()=>{
 const running=move(move(created(),'accept'),'start');
 const unknown=move(move(running,'withdraw'),'report',{run_id:id(3),summary:'Timed out',outcome:'unknown',artifacts:[]});
 const candidate=createCollaboration({...snapshot,collaborations:[unknown]},id(4),id(1),proposal,now);
 assert.throws(()=>transitionCollaboration({...snapshot,collaborations:[unknown,candidate]},candidate,'accept',{version:1},actor,now),e=>e.code==='conflict');
 assert.throws(()=>move(unknown,'reconcile',{summary:'',outcome:'success'}),e=>e.code==='invalid_input');
 const resolved=transitionCollaboration(snapshot,unknown,'reconcile',{version:1,summary:'Provider receipt confirms delivery',outcome:'success'},{kind:'user',client_id:'web',connection_id:'browser'},now);
 assert.equal(resolved.run_id,unknown.run_id);assert.deepEqual(resolved.run_actor,actor);assert.equal(resolved.outcome,'success');assert.equal(snapshot.actions[0].status,'active');
 assert.equal(createCollaboration({...snapshot,collaborations:[resolved]},id(4),id(1),proposal,now).decision,'pending');
 assert.throws(()=>move(running,'reconcile',{summary:'Assumed success',outcome:'success'}),e=>e.code==='invalid_state');
});

test('three retained proposals, one approval, cancellation preserves proposal, and editing requires fresh approval',()=>{
 const first=created(),second=createCollaboration({...snapshot,collaborations:[first]},id(4),id(1),{...proposal,title:'Alternative'},now),third=createCollaboration({...snapshot,collaborations:[first,second]},id(5),id(1),proposal,now);
 const all={...snapshot,collaborations:[first,second,third]};
 assert.throws(()=>createCollaboration(all,id(6),id(1),proposal,now),e=>e.code==='conflict');
 const approved=transitionCollaboration(all,first,'accept',{version:1},actor,now);
 assert.throws(()=>transitionCollaboration({...all,collaborations:[approved,second,third]},second,'accept',{version:1},actor,now),e=>e.code==='conflict');
 const cancelled=move(approved,'withdraw');assert.equal(cancelled.decision,'pending');assert.deepEqual(cancelled.proposal,first.proposal);assert.equal(cancelled.id,first.id);
 const again=move(cancelled,'accept');assert.equal(again.decision,'accepted');
 const edited=move(again,'revise',{proposal:{...proposal,scope:'A user correction'}});assert.equal(edited.version,2);assert.equal(edited.decision,'pending');assert.equal(edited.proposal.scope,'A user correction');
});

test('delegation is separate mode and client state that anyone may change and that never restricts a start',async()=>{
 const {collaborationHandler,assignmentReason,persistedCollaboration}=await import('../../lib/domain/collaboration.ts');
 const record=created();assert.deepEqual(record.delegation,{mode:'any_ai',client_id:null});assert.deepEqual(collaborationHandler(record),{kind:'person'},'unapproved work stays with the person');
 const specified=createCollaboration(snapshot,id(2),id(1),proposal,now,{mode:'specified_ai',client_id:'claude-client'});
 assert.deepEqual(specified.delegation,{mode:'specified_ai',client_id:'claude-client'});
 for(const invalid of [{mode:'specified_ai'},{mode:'specified_ai',client_id:''},{mode:'specified_ai',client_id:'two words'},{mode:'any_ai',client_id:'x'},{mode:'any'},'any_ai',{mode:'any_ai',client_id:null,extra:1}])assert.throws(()=>createCollaboration(snapshot,id(2),id(1),proposal,now,invalid),e=>e.code==='invalid_input');
 const accepted=move(specified,'accept');assert.deepEqual(accepted.delegation,specified.delegation,'acceptance keeps the target unless it supplies one');
 assert.deepEqual(collaborationHandler(accepted),{kind:'specified_ai',client_id:'claude-client'});
 assert.deepEqual(move(record,'accept',{delegation:{mode:'specified_ai',client_id:'chatgpt-client'}}).delegation,{mode:'specified_ai',client_id:'chatgpt-client'});
 const started=move(accepted,'start');assert.equal(started.progress,'running');assert.equal(started.run_actor.client_id,'example-client','another client may start work specified for someone else');
 const reassigned=transitionCollaboration(snapshot,started,'assign',{version:1,delegation:{mode:'any_ai'}},{kind:'client',client_id:'third-client',connection_id:'c3'},now);
 assert.deepEqual(reassigned.delegation,{mode:'any_ai',client_id:null});assert.equal(reassigned.progress,'running');assert.deepEqual(reassigned.run_actor,started.run_actor);
 assert.throws(()=>move(record,'assign'),e=>e.code==='invalid_input');assert.throws(()=>move(record,'assign',{delegation:{mode:'any_ai'},version:2}),e=>e.code==='conflict');
 assert.equal(move(record,'revise',{proposal:{...proposal,scope:'Narrower'}}).delegation,record.delegation);
 const stored=JSON.parse(JSON.stringify(accepted));assert.deepEqual(persistedCollaboration(stored),stored);
 const {delegation,...missing}=stored;assert.equal(delegation.mode,'specified_ai');assert.throws(()=>persistedCollaboration(missing),e=>e.code==='invalid_state');
 for(const bad of [{mode:'any_ai'},{mode:'specified_ai',client_id:null},{mode:'all'}])assert.throws(()=>persistedCollaboration({...stored,delegation:bad}),e=>e.code==='invalid_state');
 const me={kind:'client',client_id:'claude-client',connection_id:'claude-1'},other={kind:'client',client_id:'other-client',connection_id:'other-1'},person={kind:'user',client_id:'app',connection_id:'app-1'};
 assert.equal(assignmentReason(accepted,me,'active'),'assigned_to_you');assert.equal(assignmentReason(accepted,other,'active'),null);
 const open=move(record,'accept');assert.equal(assignmentReason(open,other,'active'),'open_to_any_ai');assert.equal(assignmentReason(open,other,'completed'),null);assert.equal(assignmentReason(move(open,'start'),other,'active'),null);
 const mine=transitionCollaboration(snapshot,open,'start',{version:1},other,now,id(5));assert.equal(assignmentReason(mine,other,'active'),'your_run');assert.equal(assignmentReason(mine,{...other,connection_id:'other-2'},'active'),null);
 assert.equal(assignmentReason(record,person,'active'),'waiting_on_you');assert.equal(assignmentReason(record,other,'active'),null);assert.equal(assignmentReason(open,person,'active'),null);
});
