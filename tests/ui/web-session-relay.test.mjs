import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
test('Web relay retains iframe and exact request across expired and different sessions',async()=>{
 const dom=new JSDOM('<iframe id="workspace"></iframe><div id="access"></div><div id="message"></div><button id="login"></button>',{url:'https://service.test',runScripts:'outside-only'});
 const {window}=dom;let notify,identity='original',expired=false,writeExpired=false;const writes=[];
 window.BroadcastChannel=class{set onmessage(fn){notify=fn;}};
 window.fetch=async(path,options)=>{
  if(path==='/api/session')return {ok:!expired,json:async()=>({account_scope:identity,csrf_token:'csrf'})};
  writes.push(JSON.parse(options.body));return {ok:!writeExpired,status:writeExpired?401:200,json:async()=>writeExpired?{error:'unauthenticated'}:{revision:1}};
 };
 try{
  window.eval(ts.transpileModule(await readFile('web/client.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText);
  const settle=()=>new Promise(resolve=>setImmediate(resolve));await settle();
  const frame=window.document.querySelector('iframe'),originalFrame=frame.contentWindow;
  const request={jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'apply_change',arguments:{operationId:'retained-exact-id',expectedRevision:0}}};
  const send=()=>window.dispatchEvent(new window.MessageEvent('message',{source:originalFrame,origin:window.location.origin,data:request}));
  writeExpired=true;send();await settle();assert.deepEqual(writes,[request.params]);assert.equal(frame.contentWindow,originalFrame);assert.equal(window.document.querySelector('#access').hidden,false);
  identity='different';notify();await settle();send();await settle();assert.equal(writes.length,1);assert.match(window.document.querySelector('#message').textContent,/different account/);assert.equal(frame.contentWindow,originalFrame);
  identity='original';writeExpired=false;notify();await settle();send();await settle();assert.deepEqual(writes,[request.params,request.params]);assert.equal(frame.contentWindow,originalFrame);
  window.dispatchEvent(new window.MessageEvent('message',{source:originalFrame,origin:'https://attacker.test',data:request}));await settle();assert.equal(writes.length,2);
 }finally{window.close();}
});
