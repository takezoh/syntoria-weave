import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

test('independent SPA keeps its mounted proposal across expiry, account mismatch and recovery',async()=>{
 const dom=new JSDOM('<header id="access"><span id="message"></span><button id="login"></button><button id="retry"></button><button id="logout"></button></header><iframe id="workspace"></iframe>',{url:'https://app.example.com',runScripts:'outside-only'});
 const {window}=dom;let notify,identity='original',expired=false;const writes=[],fetches=[],opens=[],logoutCalls=[];
 window.BroadcastChannel=class{name;set onmessage(fn){notify=fn;}constructor(name){this.name=name;}};
 window.open=(url,target,features)=>{opens.push({url,target,features});return null;};
 window.fetch=async(path,options={})=>{
  const url=String(path);fetches.push({url,options});
  if(url==='/runtime-config.json')return {ok:true,json:async()=>({apiOrigin:'https://api.example.com',gateOrigin:'https://gate.example.com',appId:'weave-spa',loginRedirectUri:'https://app.example.com/auth-return.html'})};
  if(url==='https://api.example.com/api/session')return {ok:!expired,status:expired?401:200,json:async()=>({account_scope:identity,csrf_token:'gate-csrf'})};
  if(url==='https://gate.example.com/browser/session')return {ok:true,status:200,json:async()=>({csrf_token:'logout-csrf'})};
  if(url==='https://gate.example.com/browser/logout'){logoutCalls.push({url,options});return {ok:true,status:204};}
  writes.push(JSON.parse(options.body));return {ok:!expired,status:expired?401:200,json:async()=>expired?{error:'unauthenticated'}:{revision:1}};
 };
 try{
  window.eval(ts.transpileModule(await readFile('web/client.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText);
  const settle=()=>new Promise(resolve=>setImmediate(resolve));await settle();
  const frame=window.document.querySelector('iframe'),originalFrame=frame.contentWindow,header=window.document.querySelector('#access'),logout=window.document.querySelector('#logout');
  assert.equal(frame.getAttribute('src'),'/workspace.html');
  assert.equal(header.hidden,false);assert.equal(logout.hidden,false);assert.equal(window.document.querySelector('#message').hidden,true);
  const policy=window.document.querySelector('meta[http-equiv="Content-Security-Policy"]').content;assert.match(policy,/connect-src 'self' https:\/\/api\.example\.com https:\/\/gate\.example\.com/);assert.doesNotMatch(policy,/\*/);
  const request={jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'apply_change',arguments:{operationId:'retained-exact-id',expectedRevision:0}}};
  const send=()=>window.dispatchEvent(new window.MessageEvent('message',{source:originalFrame,origin:window.location.origin,data:request}));
  expired=true;send();await settle();assert.deepEqual(writes,[request.params]);assert.equal(frame.contentWindow,originalFrame);assert.equal(window.document.querySelector('#access').hidden,false);
  assert.equal(fetches.at(-1).url,'https://api.example.com/api/actions');assert.equal(fetches.at(-1).options.credentials,'include');assert.equal(fetches.at(-1).options.headers['X-CSRF-Token'],'gate-csrf');
  window.document.querySelector('#login').click();
  const loginUrl=new URL(opens[0].url);assert.equal(opens[0].target,'_blank');assert.match(opens[0].features,/noopener/);assert.equal(loginUrl.origin,'https://gate.example.com');assert.equal(loginUrl.pathname,'/browser/login');assert.equal(loginUrl.searchParams.get('app_id'),'weave-spa');assert.equal(loginUrl.searchParams.get('redirect_uri'),'https://app.example.com/auth-return.html');
  expired=false;identity='different';notify({data:{type:'session-refresh'}});await settle();send();await settle();assert.equal(writes.length,1);assert.match(window.document.querySelector('#message').textContent,/different account/);assert.equal(frame.contentWindow,originalFrame);
  assert.equal(logout.hidden,false);assert.equal(window.document.querySelector('#login').hidden,false);logout.click();await settle();await settle();
  assert.equal(logoutCalls.length,1);assert.equal(logoutCalls[0].url,'https://gate.example.com/browser/logout');assert.equal(logoutCalls[0].options.method,'POST');assert.equal(logoutCalls[0].options.credentials,'include');assert.equal(logoutCalls[0].options.headers['X-CSRF-Token'],'logout-csrf');
  assert.equal(fetches.at(-2).url,'https://gate.example.com/browser/session');assert.equal(fetches.at(-2).options.credentials,'include');
  assert.equal(frame.contentWindow,originalFrame);assert.equal(window.document.querySelector('#login').hidden,false);assert.equal(logout.hidden,true);assert.match(window.document.querySelector('#message').textContent,/signed out/);
  send();await settle();assert.equal(writes.length,1);
  identity='original';expired=false;notify({data:{type:'session-refresh'}});await settle();send();await settle();assert.deepEqual(writes,[request.params,request.params]);assert.equal(frame.contentWindow,originalFrame);assert.equal(logout.hidden,false);
  window.dispatchEvent(new window.MessageEvent('message',{source:originalFrame,origin:'https://attacker.example.com',data:request}));await settle();assert.equal(writes.length,2);
  window.dispatchEvent(new window.MessageEvent('message',{source:null,origin:window.location.origin,data:request}));await settle();assert.equal(writes.length,2);
 }finally{window.close();}
});
