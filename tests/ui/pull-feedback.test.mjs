import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {idlePullFeedback, pullFeedbackTransition as transition, projectPullFeedback} from '../../lib/ui/model/pull-feedback.ts';
import {installPullFeedback} from '../../lib/ui/effects/pull-feedback.ts';

test('pull feedback owns tracking and settlement, while background and stale completions cannot show it',()=>{
 const start=Object.freeze({...idlePullFeedback});
 const tracking=transition(start,{type:'track',distance:70});
 assert.equal(start.distance,0);
 assert.equal(projectPullFeedback(tracking,false).label,'Release to refresh');
 assert.equal(projectPullFeedback(tracking,false).transition,'none');
 const loading=transition(transition(tracking,{type:'clear'}),{type:'request'});
 assert.equal(loading.distance,48);
 assert.equal(projectPullFeedback(loading,false).busy,true);
 assert.equal(transition(loading,{type:'clear'}),loading,'gesture cleanup does not hide the ongoing read');
 assert.deepEqual(transition(loading,{type:'settled'}),start,'success and failure use actual read settlement');
 const hidden=transition(loading,{type:'reset'});
 assert.equal(transition(hidden,{type:'settled'}),hidden,'stale read cannot revive chrome');
 assert.equal(transition(tracking,{type:'settled'}),tracking,'stale completion cannot erase newer tracking');
 assert.equal(projectPullFeedback(loading,true).transition,'none');
});

function fixture(reduced=false){
 const dom=new JSDOM('<header></header><div id="scroller"><div id="content"><div id="indicator" hidden><svg></svg></div><button id="row">Action</button></div></div><footer></footer>');
 const {window}=dom,{document}=window;
 window.matchMedia=()=>({matches:reduced,addEventListener(){},removeEventListener(){}});
 const content=document.getElementById('content'),indicator=document.getElementById('indicator'),scroller=document.getElementById('scroller');
 const api=installPullFeedback(document,window,{content,indicator});
 return {dom,window,document,content,indicator,scroller,api};
}

test('dedicated effect moves content without replacing focused rows, holds busy feedback and restores on settlement',()=>{
 const f=fixture();try{
  const row=f.document.getElementById('row');row.focus();f.scroller.scrollTop=0;
  f.api.track(30);assert.equal(f.content.style.transform,'translateY(30px)');assert.equal(f.content.style.transition,'none');
  assert.equal(f.indicator.hidden,false);assert.equal(f.scroller.style.transform,'');assert.equal(f.document.activeElement,row);
  f.api.clear();assert.equal(f.content.style.transform,'');assert.match(f.content.style.transition,/180ms/);
  f.api.track(80);f.api.clear();f.api.request();
  assert.equal(f.content.style.transform,'translateY(48px)');assert.equal(f.indicator.getAttribute('aria-busy'),'true');
  f.api.clear();assert.equal(f.indicator.hidden,false);
  f.api.settled();assert.equal(f.content.style.transform,'');assert.equal(f.indicator.hidden,true);assert.equal(f.scroller.scrollTop,0);
  f.api.settled();assert.equal(f.content.style.transform,'','manual refresh settlement cannot move content');
 }finally{f.api.dispose();f.dom.window.close();}
});

test('lifecycle reset, resize, disposal and reduced motion cancel visual state without stale resurrection',()=>{
 for(const event of ['pagehide','resize','hidden','dispose']){
  const f=fixture(true);try{
   f.api.track(80);f.api.request();assert.equal(f.content.style.transition,'none');
   if(event==='dispose')f.api.dispose();
   else if(event==='hidden'){Object.defineProperty(f.document,'visibilityState',{value:'hidden'});f.document.dispatchEvent(new f.window.Event('visibilitychange'));}
   else f.window.dispatchEvent(new f.window.Event(event));
   f.api.settled();assert.equal(f.content.style.transform,'');assert.equal(f.indicator.hidden,true);
   assert.equal(f.content.style.transition,'none');
  }finally{f.api.dispose();f.dom.window.close();}
 }
});
