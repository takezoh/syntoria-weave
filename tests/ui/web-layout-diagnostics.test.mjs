import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

const source=await readFile('web/client.ts','utf8');
const html=await readFile('web/index.html','utf8');
const expectedLabels=[
 'HTML probe marker','Client probe marker','Probe markers match','navigator.standalone',
 'display-mode standalone','display-mode fullscreen','display-mode browser','display-mode minimal-ui',
 'orientation portrait','CSS.supports -webkit-touch-callout','Safe-area probe padding top','Safe-area probe padding bottom',
 'Body padding top','Body padding right','Body padding bottom','Body padding left','--shell-top-clearance',
 'visualViewport width','visualViewport height','visualViewport offsetLeft','visualViewport offsetTop','visualViewport scale',
 'Window innerHeight','Document clientHeight','Screen height','devicePixelRatio','Window scrollY','iframe load observed',
 'iframe rect top','iframe rect left','iframe rect width','iframe rect height','iframe child innerHeight','iframe child scrollY',
 'iframe header rect top','iframe header rect left','iframe header rect width','iframe header rect height',
];

function setValue(target,key,value){Object.defineProperty(target,key,{configurable:true,value});}

async function createShell({sessionPending=false,missingApis=false}={}){
 const dom=new JSDOM(html,{url:'https://private.example.test/private/path?private-query=hidden',runScripts:'outside-only'});
 const {window}=dom,fetches=[],opened=[],storageCalls=[],consoleCalls=[],clipboardCalls=[];
 window.BroadcastChannel=class{set onmessage(_handler){}};
 window.fetch=async(input,options={})=>{
  const url=String(input);fetches.push({url,options});
  if(url==='/runtime-config.json')return {ok:true,json:async()=>({apiOrigin:'https://private-api.example.test',gateOrigin:'https://private-gate.example.test',appId:'private-app',loginRedirectUri:'https://private.example.test/auth-return.html'})};
  if(url==='https://private-api.example.test/api/session'){
   if(sessionPending)return new Promise(()=>{});
   return {ok:true,status:200,json:async()=>({account_scope:'private-account',csrf_token:'private-csrf'})};
  }
  throw new Error('Unexpected fetch: '+url);
 };
 window.open=(...args)=>{opened.push(args);return null;};
 window.console.log=(...args)=>{consoleCalls.push(args);};
 Object.defineProperty(window.navigator,'clipboard',{configurable:true,get(){clipboardCalls.push('read');return {writeText(){clipboardCalls.push('write');}};}});
 setValue(window.navigator,'sendBeacon',()=>{clipboardCalls.push('beacon');return true;});
 const storagePrototype=window.Storage.prototype;
 for(const method of ['getItem','setItem','removeItem','clear']){
  storagePrototype[method]=function(...args){storageCalls.push([method,...args]);return method==='getItem'?null:undefined;};
 }
 if(!missingApis){
  setValue(window.navigator,'standalone',true);
  setValue(window,'matchMedia',query=>({matches:query==='(display-mode: fullscreen)'||query==='(orientation: portrait)'}));
  setValue(window,'CSS',{supports:(property,value)=>property==='-webkit-touch-callout'&&value==='none'});
  setValue(window,'visualViewport',{width:390,height:800,offsetLeft:0,offsetTop:24,scale:1});
  setValue(window,'innerHeight',844);setValue(window.document.documentElement,'clientHeight',800);
  setValue(window.screen,'height',852);setValue(window,'devicePixelRatio',3);setValue(window,'scrollY',12);
 }
 window.document.body.style.padding='1px 2px 3px 4px';
 window.document.documentElement.style.setProperty('--shell-top-clearance','20px');
 const safeAreaProbe=window.document.querySelector('#safe-area-probe');
 safeAreaProbe.style.paddingTop='17px';safeAreaProbe.style.paddingBottom='19px';
 const frame=window.document.querySelector('#workspace');
 frame.getBoundingClientRect=()=>({top:26,left:4,width:382,height:790});
 window.document.querySelector('#access').getBoundingClientRect=()=>({top:0,left:0,width:390,height:44});
 window.eval(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText);
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 await settle();await settle();
 return {dom,window,fetches,opened,storageCalls,consoleCalls,clipboardCalls,settle,frame};
}

test('Display info D1 uses a fixed measurement allowlist without leaving the document or replacing the iframe',async()=>{
 const fixture=await createShell();
 const {dom,window,fetches,opened,storageCalls,consoleCalls,clipboardCalls,frame,settle}=fixture;
 try{
  const dialog=window.document.querySelector('#display-info-d1-dialog');
  const report=window.document.querySelector('#display-info-d1-report');
  const originalFrame=frame.contentWindow,originalSrc=frame.getAttribute('src');
  const prior={fetches:fetches.length,opened:opened.length,storage:storageCalls.length,logs:consoleCalls.length,clipboard:clipboardCalls.length};
  window.document.querySelector('#display-info-d1-button').click();
  await settle();
  assert.equal(dialog.open,true);
  assert.equal(frame,window.document.querySelector('#workspace'));
  assert.equal(frame.contentWindow,originalFrame);
  assert.equal(frame.getAttribute('src'),originalSrc);
  assert.deepEqual({fetches:fetches.length,opened:opened.length,storage:storageCalls.length,logs:consoleCalls.length,clipboard:clipboardCalls.length},prior);

  const lines=report.textContent.trim().split('\n');
  const entries=lines.map(line=>{const split=line.indexOf(': ');assert.notEqual(split,-1,line);return [line.slice(0,split),line.slice(split+2)];});
  assert.deepEqual(entries.map(([label])=>label),expectedLabels);
  for(const [label,value] of entries){
   if(label==='HTML probe marker'||label==='Client probe marker')assert.match(value,/^layout-probe-\d+$/u);
   else assert.match(value,/^(?:true|false|null|unavailable|-?\d+(?:\.\d+)?(?:px)?)$/u,`${label} must contain only a whitelisted measurement`);
  }
  assert.equal(entries.find(([label])=>label==='HTML probe marker')[1],'layout-probe-1');
  assert.equal(entries.find(([label])=>label==='Client probe marker')[1],'layout-probe-1');
  assert.equal(entries.find(([label])=>label==='Probe markers match')[1],'true');
  assert.equal(entries.find(([label])=>label==='Safe-area probe padding top')[1],'17px');
  assert.equal(entries.find(([label])=>label==='Safe-area probe padding bottom')[1],'19px');
  assert.equal(entries.find(([label])=>label==='Body padding top')[1],'1px');
  assert.equal(entries.find(([label])=>label==='--shell-top-clearance')[1],'20px');
  assert.equal(entries.find(([label])=>label==='visualViewport height')[1],'800');
  assert.equal(entries.find(([label])=>label==='Window scrollY')[1],'12');
  assert.equal(entries.find(([label])=>label==='iframe rect top')[1],'26');
  assert.equal(entries.find(([label])=>label==='iframe header rect top')[1],'unavailable');
  assert.doesNotMatch(report.textContent,/private|example\.test|csrf|account|cookie|workspace\.html|title|notes/iu);

  window.document.querySelector('#display-info-d1-close').click();
  assert.equal(dialog.open,false);
  assert.equal(frame.contentWindow,originalFrame);
 }finally{dom.window.close();}
});

test('Display info D1 reports missing APIs and a not-yet-loaded iframe as unavailable',async()=>{
 const fixture=await createShell({sessionPending:true,missingApis:true});
 const {dom,window,fetches,frame,settle}=fixture;
 try{
  assert.equal(frame.hasAttribute('src'),false);
  window.document.querySelector('#display-info-d1-button').click();
  await settle();
  const entries=window.document.querySelector('#display-info-d1-report').textContent.trim().split('\n').map(line=>{
   const split=line.indexOf(': ');return [line.slice(0,split),line.slice(split+2)];
  });
  const value=label=>entries.find(([key])=>key===label)?.[1];
  assert.equal(value('navigator.standalone'),'null');
  for(const label of ['display-mode standalone','display-mode fullscreen','display-mode browser','display-mode minimal-ui','orientation portrait','CSS.supports -webkit-touch-callout','visualViewport width','visualViewport height','visualViewport offsetTop','visualViewport scale','iframe child innerHeight','iframe child scrollY','iframe header rect top'])assert.equal(value(label),'unavailable',label);
  assert.equal(value('iframe load observed'),'false');
  assert.equal(fetches.filter(call=>call.url==='/runtime-config.json').length,1);
  assert.equal(fetches.filter(call=>call.url==='https://private-api.example.test/api/session').length,1);
  assert.equal(frame.hasAttribute('src'),false);
 }finally{dom.window.close();}
});
