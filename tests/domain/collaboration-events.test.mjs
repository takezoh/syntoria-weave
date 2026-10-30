import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collaborationEvents} from '../../lib/domain/collaboration-events.ts';

const record=(overrides={})=>({id:'c1',action_id:'a1',revision:2,version:1,proposal:{},metadata:'',delegation:{mode:'any_ai',client_id:null},decision:'accepted',progress:'not_started',next_actor:'ai',feedback:'',summary:'',remaining:'',outcome:'none',artifacts:[],run_id:null,run_actor:null,stop_requested:false,action_revision:1,created_at:'t',updated_at:'t',last_reported_at:null,...overrides});
const snapshot=(collaborations,status='active')=>({actions:[{id:'a1',status}],collaborations});
const ai=(client,connection)=>({id:'sub-'+connection,generation:3,actor:{kind:'client',client_id:client,connection_id:connection}});
const person={kind:'user',client_id:'web',connection_id:'browser'};

test('a request opened to any AI concerns every subscribed connection, once per record',()=>{
 const before=snapshot([record({decision:'pending'})]),after=snapshot([record()]);
 const events=collaborationEvents({before,after,record:record(),subscribers:[ai('x','x1'),ai('y','y1')],writer:person});
 assert.deepEqual(events,[{subscriptionId:'sub-x1',generation:3,collaborationId:'c1',actionId:'a1'},{subscriptionId:'sub-y1',generation:3,collaborationId:'c1',actionId:'a1'}]);
 assert.deepEqual(collaborationEvents({before,after,record:record(),subscribers:[],writer:person}),[]);
});

test('a specified handler is notified, and the former handler learns of reassignment or withdrawal',()=>{
 const toX=record({delegation:{mode:'specified_ai',client_id:'x'}}),toY=record({delegation:{mode:'specified_ai',client_id:'y'}});
 const reassigned=collaborationEvents({before:snapshot([toX]),after:snapshot([toY]),record:toY,subscribers:[ai('x','x1'),ai('y','y1'),ai('z','z1')],writer:person});
 assert.deepEqual(reassigned.map(event=>event.subscriptionId),['sub-x1','sub-y1']);
 const withdrawn=record({delegation:{mode:'specified_ai',client_id:'x'},decision:'withdrawn'});
 assert.deepEqual(collaborationEvents({before:snapshot([toX]),after:snapshot([withdrawn]),record:withdrawn,subscribers:[ai('x','x1')],writer:person}).map(event=>event.subscriptionId),['sub-x1']);
});

test('the writing connection is not told about its own change and unchanged records produce nothing',()=>{
 const running=record({progress:'running',run_actor:{kind:'client',client_id:'x',connection_id:'x1'}});
 const progressed=record({progress:'running',summary:'step 2',run_actor:running.run_actor});
 assert.deepEqual(collaborationEvents({before:snapshot([running]),after:snapshot([progressed]),record:progressed,subscribers:[ai('x','x1')],writer:running.run_actor}),[]);
 assert.deepEqual(collaborationEvents({before:snapshot([record()]),after:snapshot([record()]),record:null,subscribers:[ai('x','x1')],writer:person}),[]);
});

test('an Action status change re-evaluates its linked records without a collaboration command',()=>{
 const open=record();
 assert.deepEqual(collaborationEvents({before:snapshot([open],'active'),after:snapshot([open],'completed'),record:null,subscribers:[ai('x','x1')],writer:person}).map(event=>event.collaborationId),['c1']);
 assert.deepEqual(collaborationEvents({before:snapshot([open],'active'),after:snapshot([open],'active'),record:null,subscribers:[ai('x','x1')],writer:person}),[]);
 const pending=record({decision:'pending'});
 assert.deepEqual(collaborationEvents({before:snapshot([pending],'active'),after:snapshot([pending],'completed'),record:null,subscribers:[ai('x','x1')],writer:person}),[],'a record that concerns nobody stays silent');
});
