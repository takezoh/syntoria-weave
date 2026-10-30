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
  assert.equal(header.hidden,true,'a signed-in workspace has no access bar');assert.equal(window.document.querySelector('#message').hidden,true);
  const posted=[];originalFrame.postMessage=(data,origin)=>posted.push({data,origin});
  window.dispatchEvent(new window.MessageEvent('message',{source:originalFrame,origin:window.location.origin,data:{jsonrpc:'2.0',id:1,method:'ui/initialize',params:{}}}));await settle();assert.deepEqual(JSON.parse(JSON.stringify(posted.at(-1).data.result.hostCapabilities)),{experimental:{signOut:{},title:{}}});
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
  identity='original';expired=false;notify({data:{type:'session-refresh'}});await settle();send();await settle();assert.deepEqual(writes,[request.params,request.params]);assert.equal(frame.contentWindow,originalFrame);assert.equal(header.hidden,true);
  window.dispatchEvent(new window.MessageEvent('message',{source:originalFrame,origin:window.location.origin,data:{jsonrpc:'2.0',id:9,method:'web/sign-out',params:{}}}));await settle();await settle();await settle();
  assert.equal(logoutCalls.length,2,'the workspace asks the shell to sign out');assert.deepEqual(JSON.parse(JSON.stringify(posted.at(-1))),{data:{jsonrpc:'2.0',id:9,result:{}},origin:window.location.origin});assert.equal(header.hidden,false);assert.equal(window.document.querySelector('#login').hidden,false);assert.equal(frame.contentWindow,originalFrame);
  window.dispatchEvent(new window.MessageEvent('message',{source:originalFrame,origin:'https://attacker.example.com',data:request}));await settle();assert.equal(writes.length,2);
  window.dispatchEvent(new window.MessageEvent('message',{source:null,origin:window.location.origin,data:request}));await settle();assert.equal(writes.length,2);
 }finally{window.close();}
});

test('independent SPA opens only web and mail links requested by its workspace',async()=>{
 const dom=new JSDOM('<header id="access"><span id="message"></span><button id="login"></button><button id="retry"></button><button id="logout"></button></header><iframe id="workspace"></iframe>',{url:'https://app.example.com',runScripts:'outside-only'});
 const {window}=dom,opens=[],replies=[];
 window.BroadcastChannel=class{set onmessage(_fn){}};
 window.open=(url,target,features)=>{opens.push({url,target,features});return null;};
 window.fetch=async path=>{
  const url=String(path);
  if(url==='/runtime-config.json')return {ok:true,json:async()=>({apiOrigin:'https://api.example.com',gateOrigin:'https://gate.example.com',appId:'weave-spa',loginRedirectUri:'https://app.example.com/auth-return.html'})};
  if(url==='https://api.example.com/api/session')return {ok:true,status:200,json:async()=>({account_scope:'original',csrf_token:'gate-csrf'})};
  throw new Error('Unexpected request.');
 };
 try{
  window.eval(ts.transpileModule(await readFile('web/client.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText);
  const settle=()=>new Promise(resolve=>setImmediate(resolve));await settle();
  const frame=window.document.querySelector('iframe').contentWindow;frame.postMessage=(message,origin)=>replies.push({message,origin});
  const send=(id,url,source=frame)=>window.dispatchEvent(new window.MessageEvent('message',{source,origin:window.location.origin,data:{jsonrpc:'2.0',id,method:'ui/open-link',params:{url}}}));
  send(1,'https://example.com/docs?a=1');send(2,'javascript:alert(1)');send(3,'mailto:me@example.com');send(4,'/relative');send(5,'https://example.com/other',null);await settle();
  assert.deepEqual(opens,[{url:'https://example.com/docs?a=1',target:'_blank',features:'noopener,noreferrer'},{url:'mailto:me@example.com',target:'_blank',features:'noopener,noreferrer'}]);
  assert.deepEqual(replies.map(reply=>[reply.message.id,JSON.parse(JSON.stringify(reply.message.result)),reply.origin]),[[1,{},'https://app.example.com'],[2,{isError:true},'https://app.example.com'],[3,{},'https://app.example.com'],[4,{isError:true},'https://app.example.com']]);
 }finally{window.close();}
});

test('independent SPA names its tab after the workspace view and the configured application name',async()=>{
 const dom=new JSDOM('<title>Actions</title><header id="access"><span id="message"></span><button id="login"></button><button id="retry"></button><button id="logout"></button></header><iframe id="workspace"></iframe>',{url:'https://app.example.com',runScripts:'outside-only'});
 const {window}=dom,replies=[];
 window.BroadcastChannel=class{set onmessage(_fn){}};
 window.fetch=async path=>{
  const url=String(path);
  if(url==='/runtime-config.json')return {ok:true,json:async()=>({apiOrigin:'https://api.example.com',gateOrigin:'https://gate.example.com',appId:'weave-spa',loginRedirectUri:'https://app.example.com/auth-return.html',appName:'Example Actions'})};
  if(url==='https://api.example.com/api/session')return {ok:true,status:200,json:async()=>({account_scope:'original',csrf_token:'gate-csrf'})};
  throw new Error('Unexpected request.');
 };
 try{
  window.eval(ts.transpileModule(await readFile('web/client.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText);
  const settle=()=>new Promise(resolve=>setImmediate(resolve));await settle();
  assert.equal(window.document.title,'Example Actions','the configured name names the tab before the workspace reports a view');
  const frame=window.document.querySelector('iframe').contentWindow;frame.postMessage=(message,origin)=>replies.push({message,origin});
  const send=(id,title)=>window.dispatchEvent(new window.MessageEvent('message',{source:frame,origin:window.location.origin,data:{jsonrpc:'2.0',id,method:'web/title',params:{title}}}));
  send(1,'(1) Inbox');await settle();assert.equal(window.document.title,'(1) Inbox · Example Actions');
  send(2,'');send(3,'x\u0007y');send(4,'x'.repeat(201));await settle();assert.equal(window.document.title,'(1) Inbox · Example Actions','invalid titles change nothing');
  assert.deepEqual(replies.map(reply=>[reply.message.id,JSON.parse(JSON.stringify(reply.message.result))]),[[1,{}],[2,{isError:true}],[3,{isError:true}],[4,{isError:true}]]);
 }finally{window.close();}
});
