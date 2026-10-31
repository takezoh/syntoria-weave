import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRefreshCoordinator} from '../../lib/ui/application/refresh.ts';

const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function fixture(){
 let idle=true,reads=0,listener=null,resolve,reject;const scheduled=[],states=[];
 const coordinator=createRefreshCoordinator({read:()=>{reads++;return new Promise((yes,no)=>{resolve=yes;reject=no;});},isIdle:()=>idle,onIdle:fn=>{listener=fn;return()=>{listener=null;}},schedule:fn=>scheduled.push(fn),stateChanged:state=>states.push(state)});
 return {coordinator,scheduled,states,get reads(){return reads;},setIdle(value){idle=value;if(value)listener?.();},complete(){resolve();},fail(){reject(new Error('offline'));},runScheduled(){for(const fn of scheduled.splice(0))fn();}};
}

test('the application lane coalesces overlapping callers and reports one read outcome',async()=>{
 const f=fixture();const started=f.coordinator.start();await settle();assert.equal(f.reads,1);const first=f.coordinator.request(),second=f.coordinator.request();assert.equal(f.reads,1);f.complete();await Promise.all([started,first,second]);assert.deepEqual(f.states,['refreshing','idle']);assert.deepEqual(f.states,['refreshing','idle']);f.coordinator.dispose();
});

test('writes and IME defer one read until an explicit idle notification, outside publication',async()=>{
 const f=fixture();f.setIdle(false);f.coordinator.start();f.coordinator.request();f.coordinator.request();await settle();assert.equal(f.reads,0);
 f.setIdle(true);assert.equal(f.reads,0,'the idle observer only queues work');f.runScheduled();await settle();assert.equal(f.reads,1);f.complete();await settle();assert.deepEqual(f.states,['refreshing','idle']);f.coordinator.dispose();
});

test('failed reads keep the coordinator reusable and dispose detaches idle publication',async()=>{
 const f=fixture();f.coordinator.start();await settle();f.fail();await settle();assert.deepEqual(f.states,['refreshing','idle']);
 f.coordinator.request();await settle();assert.equal(f.reads,2);f.coordinator.dispose();f.setIdle(false);assert.equal(f.scheduled.length,0);f.fail();await settle();assert.equal(f.states.at(-1),'idle');
});


test('a new read publishes typed lane transitions only when it actually starts or settles',async()=>{
 const f=fixture();const initial=f.coordinator.start();await settle();f.complete();await initial;
 assert.equal(f.states.at(-1),'idle');
 f.setIdle(false);await f.coordinator.request();assert.equal(f.states.at(-1),'idle','a deferred request has not started a read');
 f.setIdle(true);f.runScheduled();assert.equal(f.states.at(-1),'refreshing','actual read start replaces the prior result');
 await settle();assert.equal(f.reads,2);assert.equal(f.states.at(-1),'refreshing');
 const joined=f.coordinator.request();assert.equal(f.states.filter(message=>message==='refreshing').length,2,'joining does not republish a new read');
 f.complete();await joined;assert.equal(f.states.at(-1),'idle');f.coordinator.dispose();
});
