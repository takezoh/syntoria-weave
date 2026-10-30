import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRefreshCoordinator} from '../../lib/ui/application/refresh.ts';

const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function fixture(){
 let idle=true,reads=0,listener=null,resolve,reject;const scheduled=[],messages=[],states=[];
 const coordinator=createRefreshCoordinator({read:()=>{reads++;return new Promise((yes,no)=>{resolve=yes;reject=no;});},isIdle:()=>idle,onIdle:fn=>{listener=fn;return()=>{listener=null;}},schedule:fn=>scheduled.push(fn),publish:message=>messages.push(message),stateChanged:state=>states.push(state)});
 return {coordinator,scheduled,messages,states,get reads(){return reads;},setIdle(value){idle=value;if(value)listener?.();},complete(){resolve();},fail(){reject(new Error('offline'));},runScheduled(){for(const fn of scheduled.splice(0))fn();}};
}

test('the application lane coalesces overlapping callers and reports one read outcome',async()=>{
 const f=fixture();const started=f.coordinator.start();await settle();assert.equal(f.reads,1);const first=f.coordinator.request(),second=f.coordinator.request();assert.equal(f.reads,1);f.complete();await Promise.all([started,first,second]);assert.deepEqual(f.messages,['Up to date.']);assert.deepEqual(f.states,['refreshing','idle']);f.coordinator.dispose();
});

test('writes and IME defer one read until an explicit idle notification, outside publication',async()=>{
 const f=fixture();f.setIdle(false);f.coordinator.start();f.coordinator.request();f.coordinator.request();await settle();assert.equal(f.reads,0);
 f.setIdle(true);assert.equal(f.reads,0,'the idle observer only queues work');f.runScheduled();await settle();assert.equal(f.reads,1);f.complete();await settle();assert.deepEqual(f.messages,['Up to date.']);f.coordinator.dispose();
});

test('failed reads keep the coordinator reusable and dispose detaches idle publication',async()=>{
 const f=fixture();f.coordinator.start();await settle();f.fail();await settle();assert.match(f.messages[0],/Could not refresh/);assert.deepEqual(f.states,['refreshing','idle']);
 f.coordinator.request();await settle();assert.equal(f.reads,2);f.coordinator.dispose();f.setIdle(false);assert.equal(f.scheduled.length,0);f.fail();await settle();assert.equal(f.messages.length,1);
});
