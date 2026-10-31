import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {projectScreen} from '../../lib/ui/model/screen.ts';
import {installScreen} from '../../lib/ui/effects/screen.ts';

test('screen projection is exclusive on mobile and exposes the visible wide list beside its inspector',()=>{
 assert.deepEqual(projectScreen({mobile:true,inspector:null}),{mode:'mobile',page:'list',listVisible:true});
 assert.deepEqual(projectScreen({mobile:true,inspector:'action'}),{mode:'mobile',page:'action',listVisible:false});
 assert.deepEqual(projectScreen({mobile:true,inspector:'catalog'}),{mode:'mobile',page:'catalog',listVisible:false});
 assert.deepEqual(projectScreen({mobile:true,inspector:'action',detailOpen:false}),{mode:'mobile',page:'list',listVisible:true});
 assert.deepEqual(projectScreen({mobile:false,inspector:'action',detailOpen:false}),{mode:'wide',page:'action',listVisible:true});
 assert.deepEqual(projectScreen({mobile:false,inspector:null}),{mode:'wide',page:'list',listVisible:true});
 assert.deepEqual(projectScreen({mobile:false,inspector:'action'}),{mode:'wide',page:'action',listVisible:true});
 assert.deepEqual(projectScreen({mobile:false,inspector:'catalog'}),{mode:'wide',page:'catalog',listVisible:true});
});

test('mobile detail transitions retain list anchor and focus for Action and catalog rows without changing editor identity',async()=>{
 const dom=new JSDOM('<main><header></header><div class="workspace"><div class="list-panel" tabindex="0"><div data-occurrence-key="row-1"><button class="action-select">Row</button></div><div data-outline-key="project:p"><button class="catalog-select">Project</button></div></div><div class="detail-content" id="detail"><input id="editor"></div><div class="detail-content" id="catalog"></div></div><footer></footer></main>',{pretendToBeVisual:true});
 const {document,window}=dom.window,root=document.querySelector('main'),list=document.querySelector('.list-panel'),detail=document.getElementById('detail'),catalog=document.getElementById('catalog'),input=document.getElementById('editor'),button=document.querySelector('.action-select'),catalogButton=document.querySelector('.catalog-select');
 Object.defineProperties(list,{scrollHeight:{value:1500},clientHeight:{value:500}});list.scrollTop=420;button.focus();
 const screen=installScreen(document,window,{root,listScroller:list,detailScrollers:[detail,catalog]});
 screen.apply({mode:'mobile',page:'list'});screen.apply({mode:'mobile',page:'action'},'row-1');
 assert.equal(root.dataset.mobileScreen,'action');assert.equal(detail.scrollTop,0);assert.equal(document.getElementById('editor'),input);
 detail.scrollTop=230;screen.apply({mode:'mobile',page:'catalog'},'row-1');assert.equal(root.dataset.mobileScreen,'catalog');assert.equal(catalog.scrollTop,0);
 screen.apply({mode:'mobile',page:'list'});await new Promise(resolve=>window.requestAnimationFrame(()=>resolve()));
 assert.equal(list.scrollTop,420);assert.equal(document.activeElement,button);assert.equal(input.isConnected,true);
 catalogButton.focus();screen.apply({mode:'mobile',page:'catalog'},'project:p');screen.apply({mode:'mobile',page:'list'});await new Promise(resolve=>window.requestAnimationFrame(()=>resolve()));
 assert.equal(document.activeElement,catalogButton);
 catalogButton.remove();input.focus();screen.apply({mode:'mobile',page:'catalog'},'missing');screen.apply({mode:'mobile',page:'list'});await new Promise(resolve=>window.requestAnimationFrame(()=>resolve()));
 assert.equal(document.activeElement,list,'when the selected row disappeared, Back moves focus to the list scroller');
 screen.dispose();dom.window.close();
});

test('wide projection removes the mobile page marker and does not capture or reset split panes',()=>{
 const dom=new JSDOM('<main><div class="list-panel"></div><div class="detail-content" id="detail"></div></main>');
 const {document,window}=dom.window,root=document.querySelector('main'),list=document.querySelector('.list-panel'),detail=document.getElementById('detail');
 list.scrollTop=75;detail.scrollTop=45;
 const screen=installScreen(document,window,{root,listScroller:list,detailScrollers:[detail]});
 screen.apply({mode:'wide',page:'action'});assert.equal(root.hasAttribute('data-mobile-screen'),false);assert.equal(list.scrollTop,75);assert.equal(detail.scrollTop,45);screen.dispose();dom.window.close();
});
