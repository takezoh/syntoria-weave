import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installRefresh} from '../../lib/ui/effects/refresh.ts';

test('button and foreground transitions are event sources; lifecycle adapter owns no touch sequence',()=>{
 const dom=new JSDOM('<button id="refresh">Refresh</button><div class="list-panel"></div>');const {document,window}=dom.window;let requests=0,starts=0;
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
 const api=installRefresh(document,window,{button:document.getElementById('refresh'),request:()=>{requests++;return Promise.resolve();},start:()=>{starts++;return Promise.resolve();}});
 api.start();assert.equal(starts,1);document.getElementById('refresh').click();assert.equal(requests,1);
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new window.Event('visibilitychange'));
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new window.Event('visibilitychange'));window.dispatchEvent(new window.Event('focus'));assert.equal(requests,2,'paired foreground events share one transition');
 window.dispatchEvent(new window.Event('blur'));window.dispatchEvent(new window.Event('pageshow'));assert.equal(requests,3);
 const list=document.querySelector('.list-panel');let touchListeners=0;const original=list.addEventListener.bind(list);list.addEventListener=(type,...args)=>{if(type.startsWith('touch'))touchListeners++;original(type,...args);};
 api.dispose();window.dispatchEvent(new window.Event('focus'));document.getElementById('refresh').click();assert.equal(requests,3);assert.equal(touchListeners,0);dom.window.close();
});
