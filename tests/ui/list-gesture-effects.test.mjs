import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installListGesture} from '../../lib/ui/effects/list-gesture.ts';

function fixture(){
 const dom=new JSDOM('<div class="list-panel"><div class="action-row" data-action-id="a" data-occurrence-key="a"><button class="complete">Done</button><button class="action-select">Action</button></div><div class="catalog-row" data-catalog-kind="tag" data-catalog-id="t" data-outline-key="tag:t"><button class="catalog-select">Tag</button></div></div><div id="indicator" hidden></div><div id="outside"></div>');
 const {document,window}=dom.window,scroller=document.querySelector('.list-panel'),indicator=document.getElementById('indicator'),row=document.querySelector('.action-row'),button=row.querySelector('.action-select');
 row.getBoundingClientRect=()=>({left:0,right:300,top:0,bottom:60,width:300,height:60});
 let allowed=true,pullAllowed=true,swipeAllowance={finish:true,ask:true},timerId=0;const timers=new Map(),effects={refreshes:0,suppressed:0,moves:[],begins:[],ends:0,cancels:0,opens:[],swipes:[],allowanceReads:0,widthReads:0};
 const originalBounds=row.getBoundingClientRect.bind(row);row.getBoundingClientRect=()=>{effects.widthReads++;return originalBounds();};
 const api=installListGesture(document,window,{scroller,showPull:()=>{indicator.hidden=false;},clearPull:()=>{indicator.hidden=true;},allowed:()=>allowed,canStart:()=>true,pullAllowed:()=>pullAllowed,swipeAllowance:()=>{effects.allowanceReads++;return swipeAllowance;},refresh:()=>effects.refreshes++,beginMove:(...args)=>{effects.begins.push(args);return true;},move:(x,y)=>effects.moves.push([x,y]),endMove:()=>effects.ends++,cancelMove:()=>effects.cancels++,openMove:(...args)=>effects.opens.push(args),swipe:(...args)=>effects.swipes.push(args),suppressClick:()=>effects.suppressed++,timers:{schedule:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},cancel:id=>timers.delete(id)}});
 const active=new Map();
 function touch(target,type,x=10,y=10,id=1,{cancelable=true,count=1}={}){
  let origin=active.get(id)?.target||target;if(type==='touchstart'){origin=target;active.set(id,{target:origin,x,y});}
  const point={identifier:id,target:origin,clientX:x,clientY:y};if(type==='touchmove'&&active.has(id))active.set(id,{target:origin,x,y});
  const touches=type==='touchend'||type==='touchcancel'?[]:count===1?[point]:[point,{identifier:id+1,target:origin,clientX:x+1,clientY:y+1}];
  const event=new window.Event(type,{bubbles:true,cancelable});Object.defineProperties(event,{touches:{value:touches},changedTouches:{value:[point]}});origin.dispatchEvent(event);
  if(type==='touchend'||type==='touchcancel')active.delete(id);return event;
 }
 function pen(target,type,x=10,y=10,id=7){const event=new window.Event(type,{bubbles:true,cancelable:true});Object.defineProperties(event,{pointerType:{value:'pen'},pointerId:{value:id},isPrimary:{value:true},button:{value:0},clientX:{value:x},clientY:{value:y}});target.dispatchEvent(event);return event;}
 function runTimers(){for(const [id,timer] of [...timers]){timers.delete(id);timer.fn();}}
 return {dom,document,window,scroller,indicator,row,button,outside:document.getElementById('outside'),api,timers,effects,touch,pen,runTimers,setAllowed(value){allowed=value;},setPullAllowed(value){pullAllowed=value;},setSwipeAllowance(value){swipeAllowance=value;}};
}

test('Touch listeners bind once up front, non-passive and only to the active list scroller',()=>{
 const f=fixture();try{
  const registered=[];const add=f.scroller.addEventListener.bind(f.scroller);f.scroller.addEventListener=(type,listener,options)=>{registered.push([type,options?.passive]);add(type,listener,options);};
  const api=installListGesture(f.document,f.window,{scroller:f.scroller,showPull:()=>{},clearPull:()=>{},allowed:()=>true,canStart:()=>true,pullAllowed:()=>true,swipeAllowance:()=>({finish:true,ask:false}),refresh:()=>{},beginMove:()=>true,move:()=>{},endMove:()=>{},cancelMove:()=>{},openMove:()=>{},swipe:()=>{},suppressClick:()=>{}});
  assert.deepEqual(registered.filter(([type])=>type.startsWith('touch')).sort(),[['touchcancel',undefined],['touchend',undefined],['touchmove',false],['touchstart',false]].sort());
  api.dispose();
 }finally{f.api.dispose();f.dom.window.close();}
});

test('row and whitespace pull claim only cancelable downward moves, refresh on threshold release and suppress short pulls',()=>{
 const f=fixture();try{
  const whitespaceStart=f.touch(f.scroller,'touchstart',20,10,2);assert.equal(whitespaceStart.defaultPrevented,false);
  const move=f.touch(f.scroller,'touchmove',20,170,2);assert.equal(move.defaultPrevented,true);assert.equal(f.indicator.hidden,false);f.touch(f.scroller,'touchend',20,170,2);assert.equal(f.effects.refreshes,1);assert.equal(f.effects.suppressed,1);
  f.touch(f.button,'touchstart',10,10,3);f.touch(f.button,'touchmove',10,40,3);f.touch(f.button,'touchend',10,40,3);
  assert.equal(f.effects.refreshes,1);assert.equal(f.effects.suppressed,2,'a claimed sub-threshold pull cannot become a row tap');
  f.touch(f.button,'touchstart',10,10,4);const uncancelable=f.touch(f.button,'touchmove',10,160,4,{cancelable:false});assert.equal(uncancelable.defaultPrevented,false);f.touch(f.button,'touchend',10,160,4);assert.equal(f.effects.refreshes,1);
 }finally{f.api.dispose();f.dom.window.close();}
});

test('native scroll is terminal, avoids row geometry/eligibility work and control origins do not claim',()=>{
 const f=fixture();try{
  f.scroller.scrollTop=40;f.touch(f.button,'touchstart',10,10,5);const vertical=f.touch(f.button,'touchmove',10,100,5);assert.equal(vertical.defaultPrevented,false);const widthReads=f.effects.widthReads,allowanceReads=f.effects.allowanceReads;
  f.touch(f.button,'touchmove',200,100,5);assert.equal(f.effects.widthReads,widthReads);assert.equal(f.effects.allowanceReads,allowanceReads);assert.equal(f.effects.swipes.length,0);f.touch(f.button,'touchend',200,100,5);
  f.scroller.scrollTop=0;const complete=f.row.querySelector('.complete');f.touch(complete,'touchstart',5,5,6);const control=f.touch(complete,'touchmove',5,170,6);assert.equal(control.defaultPrevented,false);f.touch(complete,'touchend',5,170,6);assert.equal(f.effects.refreshes,0);
 }finally{f.api.dispose();f.dom.window.close();}
});

test('swipe eligibility is read at commit and touch-origin Pointer cancellation does not steal the sequence',()=>{
 const f=fixture();try{
  f.touch(f.button,'touchstart',10,20,8);f.touch(f.button,'touchmove',150,22,8);assert.equal(f.row.classList.contains('swiping'),true);f.setSwipeAllowance({finish:false,ask:false});
  f.pen(f.button,'pointercancel',150,22,8);assert.equal(f.row.classList.contains('swiping'),true,'pointer cancellation cannot cancel Touch Events');
  f.touch(f.button,'touchend',150,22,8);assert.equal(f.effects.swipes.at(-1)[1],null);assert.equal(f.effects.suppressed,1);assert.equal(f.row.classList.contains('swiping'),false);
 }finally{f.api.dispose();f.dom.window.close();}
});

test('touch and pen share hold and move arbitration; non-cancelable movement cancels without committing',()=>{
 const f=fixture();try{
  f.touch(f.button,'touchstart',10,20,9);f.runTimers();assert.equal(f.effects.begins[0][4],'touch');
  const uncancelable=f.touch(f.button,'touchmove',30,40,9,{cancelable:false});assert.equal(uncancelable.defaultPrevented,false);assert.equal(f.effects.cancels,1);f.touch(f.button,'touchend',30,40,9);assert.equal(f.effects.ends,0);
  f.pen(f.button,'pointerdown',10,20,11);f.runTimers();assert.equal(f.effects.begins.at(-1)[4],'pen');f.pen(f.button,'pointermove',30,40,11);f.pen(f.button,'pointerup',30,40,11);assert.equal(f.effects.ends,1);
 }finally{f.api.dispose();f.dom.window.close();}
});

test('pen move, release and cancel outside the list are filtered by pointer ID and clear the pending hold',()=>{
 const f=fixture();try{
  f.setPullAllowed(false);
  f.pen(f.button,'pointerdown',10,20,21);assert.equal(f.timers.size,1);
  f.pen(f.outside,'pointermove',12,22,22);f.pen(f.outside,'pointerup',12,22,22);assert.equal(f.timers.size,1,'an unrelated pointer cannot end the active pen contact');
  f.pen(f.outside,'pointermove',12,22,21);assert.equal(f.timers.size,1);
  f.pen(f.outside,'pointerup',12,22,21);assert.equal(f.timers.size,0,'the active pointerup is observed beyond the list');
  f.runTimers();assert.equal(f.effects.begins.length,0,'the stale timeout cannot lift a released row');assert.equal(f.row.classList.contains('lifted'),false);

  f.pen(f.button,'pointerdown',10,20,23);f.pen(f.outside,'pointercancel',10,20,23);assert.equal(f.timers.size,0);
  f.runTimers();assert.equal(f.effects.begins.length,0,'outside pointercancel also terminates the active sequence');
 }finally{f.api.dispose();f.dom.window.close();}
});

test('multi-touch, pagehide, hidden visibility, resize, stale timers and disposal clean active state',()=>{
 for(const cancelBy of ['multi','pagehide','hidden','resize','dispose']){
  const f=fixture();f.touch(f.button,'touchstart',10,20,14);
  if(cancelBy==='multi')f.touch(f.button,'touchstart',10,20,14,{count:2});
  if(cancelBy==='pagehide')f.window.dispatchEvent(new f.window.Event('pagehide'));
  if(cancelBy==='hidden'){Object.defineProperty(f.document,'visibilityState',{configurable:true,value:'hidden'});f.document.dispatchEvent(new f.window.Event('visibilitychange'));}
  if(cancelBy==='resize')f.window.dispatchEvent(new f.window.Event('resize'));
  if(cancelBy==='dispose')f.api.dispose();
  f.runTimers();assert.equal(f.effects.begins.length,0,cancelBy);f.touch(f.button,'touchend',10,20,14);assert.equal(f.effects.opens.length,0,cancelBy);f.api.dispose();f.dom.window.close();
 }
});
