type RuntimeConfig=Readonly<{apiOrigin:string;gateOrigin:string;appId:string;loginRedirectUri:string;appName:string|null}>;
type Session=Readonly<{account_scope:string;csrf_token:string}>;

const frame=document.querySelector<HTMLIFrameElement>('#workspace')!;
const access=document.querySelector<HTMLElement>('#access')!,message=document.querySelector<HTMLElement>('#message')!;
const login=document.querySelector<HTMLButtonElement>('#login')!,logoutButton=document.querySelector<HTMLButtonElement>('#logout')!,retry=document.querySelector<HTMLButtonElement>('#retry')!;
const refreshChannelName='action-tools-browser-session-refresh';
const channel=new BroadcastChannel(refreshChannelName);
const pending=new Set<string>();
let runtime:RuntimeConfig|null=null,session:Session|null=null,account:string|null=null,blocked=true,viewTitle:string|null=null;
const layoutProbeClientMarker='layout-probe-1';
let workspaceLoaded=false;
frame.addEventListener('load',()=>{if(frame.hasAttribute('src'))workspaceLoaded=true;});

function installDisplayInfo(){
 const button=document.querySelector<HTMLButtonElement>('#display-info-d1-button');
 const dialog=document.querySelector<HTMLDialogElement>('#display-info-d1-dialog');
 const report=document.querySelector<HTMLElement>('#display-info-d1-report');
 const closeButton=document.querySelector<HTMLButtonElement>('#display-info-d1-close');
 const safeAreaProbe=document.querySelector<HTMLElement>('#safe-area-probe');
 if(!button||!dialog||!report||!closeButton)return;

 function numberMetric(read:()=>unknown){
  try{const value=read();return typeof value==='number'&&Number.isFinite(value)?String(value):'unavailable';}catch{return 'unavailable';}
 }
 function cssPixelMetric(element:Element|null,property:string){
  try{
   if(!element)return 'unavailable';
   const value=window.getComputedStyle(element).getPropertyValue(property).trim();
   return /^(?:\d+(?:\.\d+)?|\.\d+)px$/u.test(value)?value:'unavailable';
  }catch{return 'unavailable';}
 }
 function mediaFlag(query:string):boolean|null{
  try{return typeof window.matchMedia==='function'?window.matchMedia(query).matches:null;}catch{return null;}
 }
 function flag(value:boolean|null){return value===null?'unavailable':String(value);}
 function rectLines(label:string,element:Element|null){
  let rect:DOMRect|null=null;
  try{rect=element?.getBoundingClientRect()??null;}catch{}
  return (['top','left','width','height'] as const).map(edge=>`${label} ${edge}: ${rect?numberMetric(()=>rect![edge]):'unavailable'}`);
 }
 function childMetric(read:(child:Window)=>unknown){
  try{
   const childDocument=frame.contentDocument,child=frame.contentWindow;
   if(!workspaceLoaded||!child||!childDocument||childDocument.readyState!=='complete'||!childDocument.documentElement)return 'unavailable';
   const value=read(child);
   return typeof value==='number'&&Number.isFinite(value)?String(value):'unavailable';
  }catch{return 'unavailable';}
 }
 function childHeaderRectLines(){
  try{
   const childDocument=frame.contentDocument,child=frame.contentWindow;
   if(!workspaceLoaded||!child||!childDocument||childDocument.readyState!=='complete'||!childDocument.documentElement)return rectLines('iframe header rect',null);
   return rectLines('iframe header rect',childDocument.querySelector('header'));
  }catch{return rectLines('iframe header rect',null);}
 }
 function collectReport(){
  const rawHtmlMarker=document.querySelector<HTMLMetaElement>('meta[name="layout-probe"]')?.content??'';
  const htmlMarker=/^layout-probe-\d+$/u.test(rawHtmlMarker)?rawHtmlMarker:'unavailable';
  const standalone=(window.navigator as Navigator&{standalone?:unknown}).standalone;
  const standaloneValue=typeof standalone==='boolean'?String(standalone):'null';
  let webkitCallout:boolean|null=null;
  try{if(typeof CSS!=='undefined'&&typeof CSS.supports==='function')webkitCallout=CSS.supports('-webkit-touch-callout','none');}catch{}
  const lines=[
   `HTML probe marker: ${htmlMarker}`,
   `Client probe marker: ${layoutProbeClientMarker}`,
   `Probe markers match: ${htmlMarker===layoutProbeClientMarker}`,
   `navigator.standalone: ${standaloneValue}`,
   `display-mode standalone: ${flag(mediaFlag('(display-mode: standalone)'))}`,
   `display-mode fullscreen: ${flag(mediaFlag('(display-mode: fullscreen)'))}`,
   `display-mode browser: ${flag(mediaFlag('(display-mode: browser)'))}`,
   `display-mode minimal-ui: ${flag(mediaFlag('(display-mode: minimal-ui)'))}`,
   `orientation portrait: ${flag(mediaFlag('(orientation: portrait)'))}`,
   `CSS.supports -webkit-touch-callout: ${flag(webkitCallout)}`,
   `Safe-area probe padding top: ${cssPixelMetric(safeAreaProbe,'padding-top')}`,
   `Safe-area probe padding bottom: ${cssPixelMetric(safeAreaProbe,'padding-bottom')}`,
   `Body padding top: ${cssPixelMetric(document.body,'padding-top')}`,
   `Body padding right: ${cssPixelMetric(document.body,'padding-right')}`,
   `Body padding bottom: ${cssPixelMetric(document.body,'padding-bottom')}`,
   `Body padding left: ${cssPixelMetric(document.body,'padding-left')}`,
   `--shell-top-clearance: ${cssPixelMetric(document.documentElement,'--shell-top-clearance')}`,
   `visualViewport width: ${numberMetric(()=>window.visualViewport?.width)}`,
   `visualViewport height: ${numberMetric(()=>window.visualViewport?.height)}`,
   `visualViewport offsetLeft: ${numberMetric(()=>window.visualViewport?.offsetLeft)}`,
   `visualViewport offsetTop: ${numberMetric(()=>window.visualViewport?.offsetTop)}`,
   `visualViewport scale: ${numberMetric(()=>window.visualViewport?.scale)}`,
   `Window innerHeight: ${numberMetric(()=>window.innerHeight)}`,
   `Document clientHeight: ${numberMetric(()=>document.documentElement.clientHeight)}`,
   `Screen height: ${numberMetric(()=>window.screen.height)}`,
   `devicePixelRatio: ${numberMetric(()=>window.devicePixelRatio)}`,
   `Window scrollY: ${numberMetric(()=>window.scrollY)}`,
   `iframe load observed: ${workspaceLoaded}`,
   ...rectLines('iframe rect',frame),
   `iframe child innerHeight: ${childMetric(child=>child.innerHeight)}`,
   `iframe child scrollY: ${childMetric(child=>child.scrollY)}`,
   ...childHeaderRectLines(),
  ];
  return lines.join('\n');
 }
 button.addEventListener('click',()=>{
  report.textContent=collectReport();
  if(dialog.open)return;
  try{if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}catch{dialog.setAttribute('open','');}
 });
 closeButton.addEventListener('click',()=>{
  try{if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}catch{dialog.removeAttribute('open');}
 });
 dialog.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&dialog.open&&typeof dialog.close!=='function'){dialog.removeAttribute('open');closeButton.focus();}
 });
}
installDisplayInfo();

function exactHttpsOrigin(value:unknown){
 if(typeof value!=='string')throw new Error('Invalid runtime origin.');
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||url.origin!==value)throw new Error('Invalid runtime origin.');
 return url.origin;
}

async function readRuntimeConfig():Promise<RuntimeConfig>{
 const response=await fetch('/runtime-config.json',{cache:'no-store',credentials:'omit',redirect:'error'});
 if(!response.ok)throw new Error('Runtime configuration is unavailable.');
 const value=await response.json() as Partial<RuntimeConfig>;
 const apiOrigin=exactHttpsOrigin(value.apiOrigin),gateOrigin=exactHttpsOrigin(value.gateOrigin);
 const redirect=typeof value.loginRedirectUri==='string'?new URL(value.loginRedirectUri):null;
 if(!redirect||redirect.protocol!=='https:'||redirect.username||redirect.password||redirect.search||redirect.hash||redirect.origin!==window.location.origin||redirect.href!==value.loginRedirectUri)throw new Error('Invalid login return URI.');
 if(typeof value.appId!=='string'||!/^[A-Za-z0-9._~-]{1,100}$/.test(value.appId))throw new Error('Invalid registered application ID.');
 return Object.freeze({apiOrigin,gateOrigin,appId:value.appId,loginRedirectUri:redirect.href,appName:displayName(value.appName)});
}

/** Plain display text of at most `limit` characters without control characters, or null. */
function displayName(value:unknown,limit=60){
 return typeof value==='string'&&value===value.trim()&&value.length>0&&value.length<=limit&&!/[\u0000-\u001f\u007f]/u.test(value)?value:null;
}

/** The tab names the workspace's current view, followed by the configured application name. */
function applyTitle(){
 const name=runtime?.appName??null;
 if(viewTitle)document.title=name?viewTitle+' · '+name:viewTitle;else if(name)document.title=name;
}

/** The access bar shows only while access needs the person; signed in, the workspace offers Sign out itself. */
function showState(text:string,mode:'login'|'retry'|'authenticated'|'recovery'='login'){
 access.hidden=mode==='authenticated';
 message.textContent=text;
 message.hidden=mode==='authenticated';
 login.hidden=mode!=='login'&&mode!=='recovery';
 retry.hidden=mode!=='retry';
 logoutButton.hidden=mode!=='authenticated'&&mode!=='recovery';
}

function sessionUrl(){return new URL('/api/session',runtime!.apiOrigin);}
function actionsUrl(){return new URL('/api/actions',runtime!.apiOrigin);}
function gateUrl(path:string){return new URL(path,runtime!.gateOrigin);}

function installContentPolicy(value:RuntimeConfig){
 const policy=document.createElement('meta');
 policy.httpEquiv='Content-Security-Policy';
 policy.content=`default-src 'none'; base-uri 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src 'self'; connect-src 'self' ${value.apiOrigin} ${value.gateOrigin}`;
 document.head.appendChild(policy);
}

async function refreshSession(){
 if(!runtime)return false;
 let response:Response;
 try{response=await fetch(sessionUrl(),{cache:'no-store',credentials:'include',mode:'cors'});}
 catch{session=null;blocked=true;showState('The API authorization service is unavailable. Try again shortly.','retry');return false;}
 if(response.status===401){session=null;blocked=true;showState(account?'Sign in again with the original account. Your edits are retained.':'Sign in to open your actions.',account?'recovery':'login');return false;}
 if(response.status===503){session=null;blocked=true;showState('The API authorization service is unavailable. Try again shortly.','retry');return false;}
 if(!response.ok){session=null;blocked=true;showState('The API could not confirm this session. Try again shortly.','retry');return false;}
 const next=await response.json() as Session;
 if(typeof next.account_scope!=='string'||typeof next.csrf_token!=='string'||!next.csrf_token){session=null;blocked=true;showState('The API returned an invalid session response.','retry');return false;}
 if(account&&account!==next.account_scope){session=null;blocked=true;showState('A different account is signed in. Your prior edits are retained. Sign out this device, then sign back into the original account.','recovery');return false;}
 blocked=false;account=next.account_scope;session=next;showState('Signed in.','authenticated');
 if(!frame.getAttribute('src'))frame.src='/workspace.html';
 frame.hidden=false;
 return true;
}

function startLogin(){
 if(!runtime)return;
 const target=gateUrl('/browser/login');
 target.searchParams.set('app_id',runtime.appId);
 target.searchParams.set('redirect_uri',runtime.loginRedirectUri);
 window.open(target.href,'_blank','noopener');
}

async function performLogout(){
 if(!runtime)return;
 try{
  const bootstrap=await fetch(gateUrl('/browser/session'),{cache:'no-store',credentials:'include',mode:'cors'});
  if(!bootstrap.ok){
   if(bootstrap.status===401){session=null;blocked=true;showState('This device is signed out. Your edits are retained. Sign in with the original account.','login');}
   else showState('Gate authorization is unavailable. Try again shortly.','retry');
   return;
  }
  const value=await bootstrap.json() as {csrf_token?:unknown};
  if(typeof value.csrf_token!=='string'||!value.csrf_token)throw new Error('Gate returned an invalid logout token.');
  const response=await fetch(gateUrl('/browser/logout'),{method:'POST',cache:'no-store',credentials:'include',mode:'cors',headers:{'Content-Type':'application/json','X-CSRF-Token':value.csrf_token},body:'{}'});
  if(!response.ok&&response.status!==401)throw new Error('Gate could not sign out this device.');
  session=null;blocked=true;showState('This device is signed out. Your edits are retained. Sign in with the original account.','login');
 }catch{showState('Gate authorization is unavailable. Try again shortly.','retry');}
}

/** Only web and mail destinations leave the workspace, always in a separate browsing context. */
function linkTarget(value:unknown){
 if(typeof value!=='string')return null;
 try{const url=new URL(value);return ['http:','https:','mailto:'].includes(url.protocol)?url.href:null;}catch{return null;}
}

function idKey(id:unknown){
 if(typeof id==='string')return 's:'+id;
 if(typeof id==='number'&&Number.isFinite(id))return 'n:'+id;
 return null;
}

login.addEventListener('click',startLogin);
retry.addEventListener('click',()=>{void refreshSession();});
logoutButton.addEventListener('click',()=>{void performLogout();});
channel.onmessage=event=>{if(event.data?.type==='session-refresh')void refreshSession();};
window.addEventListener('focus',()=>{if(blocked)void refreshSession();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&blocked)void refreshSession();});

window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.origin!==window.location.origin||event.data?.jsonrpc!=='2.0')return;
 const call=event.data as {jsonrpc:string;id?:unknown;method?:unknown;params?:unknown};
 const key=idKey(call.id);if(!key||pending.has(key))return;
 pending.add(key);
 let result:unknown;
 try{
  if(call.method==='ui/initialize')result={protocolVersion:'2026-01-26',hostInfo:{name:'web',version:'0.3.0'},hostCapabilities:{experimental:{signOut:{},title:{}}},hostContext:{displayMode:'fullscreen',availableDisplayModes:['fullscreen'],platform:'web'}};
  else if(call.method==='ui/request-display-mode')result={mode:'fullscreen'};
  else if(call.method==='web/sign-out'){await performLogout();result={};}
  else if(call.method==='web/title'){const title=displayName((call.params as {title?:unknown}|undefined)?.title,200);if(title){viewTitle=title;applyTitle();}result=title?{}:{isError:true};}
  else if(call.method==='ui/open-link'){const url=linkTarget((call.params as {url?:unknown}|undefined)?.url);if(url)window.open(url,'_blank','noopener,noreferrer');result=url?{}:{isError:true};}
  else if(call.method==='tools/call'){
   if(blocked||!session||!runtime)result={isError:true,structuredContent:{error:{code:'unauthenticated',message:'Sign into the original account. Your proposal is retained.'}}};
   else{
    try{
     const response=await fetch(actionsUrl(),{method:'POST',cache:'no-store',credentials:'include',mode:'cors',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf_token},body:JSON.stringify(call.params)});
     const data=await response.json() as {error?:string;message?:string};
     result=response.ok?{structuredContent:data}:{isError:true,structuredContent:{error:{code:data.error??'outcome_unknown',message:data.message}}};
     if(response.status===401){session=null;blocked=true;showState('A different account or expired session was detected. Your proposal and exact request are retained. Sign out this device, then sign back into the original account.','recovery');}
     else if(response.status===503){session=null;blocked=true;showState('Authorization is unavailable. Your proposal and exact request are retained. Try again shortly.','retry');}
    }catch{result={isError:true,structuredContent:{error:{code:'outcome_unknown',message:'Retain the exact request and check its result.'}}};}
   }
  }else return;
 }finally{pending.delete(key);}
 if(event.source===frame.contentWindow)frame.contentWindow?.postMessage({jsonrpc:'2.0',id:call.id,result},window.location.origin);
});

void readRuntimeConfig().then(async value=>{
 runtime=value;
 applyTitle();
 installContentPolicy(value);
 await refreshSession();
}).catch(()=>showState('This SPA is missing valid runtime configuration.','retry'));
