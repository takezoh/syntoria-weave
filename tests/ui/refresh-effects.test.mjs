import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installRefresh} from '../../lib/ui/effects/refresh.ts';
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
function fixture(){
 const dom=new JSDOM('<button id="refresh">Refresh</button><div id="list"><div id="indicator"></div><span id="row">Row</span><input id="input"></div>'),w=dom.window,d=w.document;
 let count=0,blocked=false,resolve,reject,claims=0;const messages=[];
 Object.defineProperty(d,'visibilityState',{configurable:true,value:'visible'});
 const moves=new Set(),list=d.getElementById('list'),add=list.addEventListener.bind(list),remove=list.removeEventListener.bind(list);
 list.addEventListener=(type,fn,options)=>{if(type==='touchmove'&&options?.passive===false)moves.add(fn);add(type,fn,options);};
 list.removeEventListener=(type,fn,options)=>{if(type==='touchmove')moves.delete(fn);remove(type,fn,options);};
 const api=installRefresh(d,w,{scroller:d.getElementById('list'),indicator:d.getElementById('indicator'),button:d.getElementById('refresh'),refresh:()=>{count++;return new Promise((yes,no)=>{resolve=yes;reject=no;});},blocked:()=>blocked,pullAllowed:()=>true,claimPull:()=>claims++,message:m=>messages.push(m)});
 function touch(type,x=0,y=0,options={}){const e=new w.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'?[]:Array.from({length:options.count??1},(_,i)=>({identifier:i,clientX:x,clientY:y}))});d.getElementById(options.target??'row').dispatchEvent(e);return e;}
 function visible(value){Object.defineProperty(d,'visibilityState',{configurable:true,value});d.dispatchEvent(new w.Event('visibilitychange'));}
 return {api,w,d,dom,touch,visible,messages,get blockers(){return moves.size;},get count(){return count;},get claims(){return claims;},block(v){blocked=v;},complete(){resolve();},fail(){reject(new Error('network'));},close(){api.dispose();dom.window.close();}};
}
test('button and foreground refresh share a lane, queue while saving and recover after failure',async()=>{
 const f=fixture();try{
 f.api.start();await settle();assert.equal(f.count,1);
 f.d.getElementById('refresh').click();f.visible('hidden');f.visible('visible');f.w.dispatchEvent(new f.w.Event('focus'));await settle();assert.equal(f.count,1);
 f.complete();await settle();f.block(true);f.visible('hidden');f.visible('visible');await settle();assert.equal(f.count,1);
 f.block(false);f.api.flush();await settle();assert.equal(f.count,2);f.fail();await settle();assert.match(f.messages.at(-1),/Could not refresh/);
 f.d.getElementById('refresh').click();await settle();assert.equal(f.count,3);f.complete();await settle();assert.equal(f.messages.at(-1),'Up to date.');
 f.api.dispose();f.visible('hidden');f.visible('visible');f.d.getElementById('refresh').click();await settle();assert.equal(f.count,3);
 }finally{f.close();}
});
test('pull starts only at top and refreshes once on release; canceled, horizontal, short and multi-touch do not refresh',async()=>{
 const f=fixture();try{
 f.api.start();await settle();f.complete();await settle();
 f.d.getElementById('list').scrollTop=50;f.touch('touchstart');f.touch('touchmove',0,160);f.touch('touchend');await settle();assert.equal(f.count,1);
 f.d.getElementById('list').scrollTop=0;
 for(const [x,y,type,options] of [[150,10,'touchend',{}],[0,80,'touchend',{}],[0,160,'touchcancel',{}],[0,160,'touchend',{count:2}],[0,160,'touchend',{target:'input'}]]){f.touch('touchstart',0,0,options);f.touch('touchmove',x,y,options);f.touch(type);}
 await settle();assert.equal(f.count,1);
 f.touch('touchstart');assert.equal(f.touch('touchmove',0,160).defaultPrevented,true);assert.equal(f.d.getElementById('indicator').textContent,'Release to refresh');f.touch('touchend');await settle();assert.equal(f.count,2);assert.ok(f.claims>0);
 f.touch('touchstart');f.touch('touchmove',0,160);f.touch('touchend');await settle();assert.equal(f.count,2);f.complete();await settle();assert.equal(f.d.getElementById('indicator').hidden,true);
 }finally{f.close();}
});

test('ordinary scrolling has no blocking move listener and pull feedback never changes layout height',async()=>{
 const f=fixture();try{
 f.api.start();await settle();f.complete();await settle();assert.equal(f.blockers,0);
 f.d.getElementById('list').scrollTop=10;f.touch('touchstart');assert.equal(f.blockers,0);assert.equal(f.touch('touchmove',0,-100).defaultPrevented,false);
 f.d.getElementById('list').scrollTop=0;f.touch('touchstart');assert.equal(f.blockers,1);f.touch('touchmove',0,-20);assert.equal(f.blockers,0);
 f.touch('touchstart');f.touch('touchmove',0,160);assert.equal(f.d.getElementById('indicator').style.height,'');assert.match(f.d.getElementById('indicator').style.transform,/translateY/);f.touch('touchcancel');assert.equal(f.blockers,0);
 f.touch('touchstart');f.api.dispose();assert.equal(f.blockers,0);
 }finally{f.close();}
});
