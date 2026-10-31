import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listGestureTransition} from '../../lib/ui/model/list-gesture.ts';

const row=Object.freeze({id:'action-1',key:'action-1',kind:'action',swipeable:true,movable:true});
const start=(patch={})=>listGestureTransition({phase:'idle'},{type:'start',source:'touch',token:1,touchId:4,x:10,y:10,atTop:true,pullAllowed:true,eligible:true,row,touchCount:1,...patch});
const move=(state,patch={})=>listGestureTransition(state,{type:'move',token:state.token,touchId:state.touchId,x:10,y:40,touchCount:1,cancelable:true,allowed:true,pullAllowed:true,swipeAllowance:{finish:true,ask:true},rowWidth:300,...patch});
const end=(state,patch={})=>listGestureTransition(state,{type:'end',token:state.token,touchId:state.touchId,touchCount:0,allowed:true,pullAllowed:true,swipeAllowance:{finish:true,ask:true},rowWidth:300,...patch});

test('one sequence owner distinguishes pull from native scroll and refreshes only after threshold release',()=>{
 const pending=start().state;const claimed=move(pending,{y:150});
 assert.equal(claimed.state.phase,'pull');assert(claimed.effects.some(effect=>effect.type==='prevent-default'));
 const extended=move(claimed.state,{y:160});assert.equal(extended.state.distance,75);
 const released=end(extended.state);assert.deepEqual(released.effects.filter(effect=>['suppress-click','request-refresh'].includes(effect.type)).map(effect=>effect.type),['suppress-click','request-refresh']);
 const short=end(move(pending,{y:50}).state);assert.equal(short.effects.some(effect=>effect.type==='request-refresh'),false);assert(short.effects.some(effect=>effect.type==='suppress-click'));
 const scrolled=move(start({atTop:false}).state,{y:150});assert.equal(scrolled.state.phase,'scroll');assert.deepEqual(move(scrolled.state,{x:200,y:10}).effects,[],'native scroll remains terminal for this contact');
});

test('pull cancellation suppresses the trailing tap, while pull policy does not disable swipe or hold',()=>{
 const pulled=move(start().state,{y:150}).state;const reversed=move(pulled,{y:0});
 assert.equal(reversed.state.phase,'idle');assert(reversed.effects.some(effect=>effect.type==='suppress-click'));

 const unavailable=start({pullAllowed:false}).state;
 const swiping=move(unavailable,{x:150,y:10,pullAllowed:false});assert.equal(swiping.state.phase,'swipe');
 const invalidated=end(swiping.state,{swipeAllowance:{finish:false,ask:false}});
 assert.equal(invalidated.effects.find(effect=>effect.type==='commit-swipe').choice,null,'commit rechecks current row eligibility');

 const holdStart=start({pullAllowed:false}).state;const held=listGestureTransition(holdStart,{type:'hold-timeout',token:1});
 assert.equal(held.state.phase,'held');assert.equal(held.effects.some(effect=>effect.type==='prevent-default'),false,'a timer owns no live event');
});

test('a held move requires the current live event to be cancelable and never commits after cancellation',()=>{
 const held=listGestureTransition(start().state,{type:'hold-timeout',token:1}).state;
 const rejected=move(held,{x:30,y:30,cancelable:false});assert.equal(rejected.state.phase,'idle');
 assert(rejected.effects.some(effect=>effect.type==='cancel-move'));assert.equal(rejected.effects.some(effect=>effect.type==='end-move'),false);
 const moving=move(held,{x:30,y:30});assert.equal(moving.state.phase,'move');assert(moving.effects.some(effect=>effect.type==='move'));
 assert(end(moving.state).effects.some(effect=>effect.type==='end-move'));
});

test('multi-contact, stale sequence events and out-of-scope releases cannot act on a newer contact',()=>{
 const pending=start().state;
 const multi=listGestureTransition(pending,{type:'move',token:1,touchId:4,x:10,y:100,touchCount:2,cancelable:true,allowed:true,pullAllowed:true,swipeAllowance:{finish:true,ask:true},rowWidth:300});
 assert.equal(multi.state.phase,'idle');
 const next=start({token:2,touchId:8}).state;
 const stale=listGestureTransition(next,{type:'hold-timeout',token:1});assert.equal(stale.state.phase,'pending');assert.deepEqual(stale.effects,[]);
 const wrongEnd=listGestureTransition(next,{type:'end',token:2,touchId:9,touchCount:0,allowed:true,pullAllowed:true,swipeAllowance:{finish:true,ask:true},rowWidth:300});
 assert.equal(wrongEnd.state.phase,'pending','an out-of-scope release cannot terminate the newer contact');assert.equal(wrongEnd.effects.length,0);
});
