const frame=document.querySelector<HTMLIFrameElement>('#workspace')!;
const access=document.querySelector<HTMLElement>('#access')!,message=document.querySelector<HTMLElement>('#message')!;
let session:{account_scope:string;csrf_token:string}|null=null,account:string|null=null,blocked=false;
const channel=crypto.randomUUID().replaceAll('-','');
async function refreshSession(){
 const response=await fetch('/api/session',{cache:'no-store'});if(!response.ok){access.hidden=false;return false;}
 const next=await response.json() as NonNullable<typeof session>;
 if(account&&account!==next.account_scope){blocked=true;message.textContent='A different account is signed in. Your prior edits are retained. Sign back into the original account.';access.hidden=false;return false;}
 blocked=false;account=next.account_scope;session=next;access.hidden=true;
 if(!frame.getAttribute('src'))frame.src='/ui/widget';frame.hidden=false;return true;
}
document.querySelector<HTMLButtonElement>('#login')!.onclick=()=>{window.open('/auth/login?channel='+channel,'_blank','noopener');};
new BroadcastChannel(channel).onmessage=()=>{void refreshSession();};
window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.origin!==window.location.origin||event.data?.jsonrpc!=='2.0'||event.data.id==null)return;
 const call=event.data;let result:unknown;
 if(call.method==='ui/initialize')result={protocolVersion:'2026-01-26',hostInfo:{name:'web',version:'0.3.0'},hostCapabilities:{},hostContext:{displayMode:'fullscreen',availableDisplayModes:['fullscreen'],platform:'web'}};
 else if(call.method==='ui/request-display-mode')result={mode:'fullscreen'};
 else if(call.method==='tools/call'){
  try{
   if(blocked||!session){result={isError:true,structuredContent:{error:{code:'unauthenticated',message:'Sign into the original account. Your proposal is retained.'}}};}
   else{
    const response=await fetch('/api/actions',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf_token},body:JSON.stringify(call.params)});
    const data=await response.json() as {error?:string;message?:string};result=response.ok?{structuredContent:data}:{isError:true,structuredContent:{error:{code:data.error??'outcome_unknown',message:data.message}}};
    if(response.status===401){session=null;access.hidden=false;message.textContent='Sign in again. Your proposal and exact request are retained.';}
   }
  }catch{result={isError:true,structuredContent:{error:{code:'outcome_unknown',message:'Retain the exact request and check its result.'}}};}
 }else return;
 frame.contentWindow?.postMessage({jsonrpc:'2.0',id:call.id,result},window.location.origin);
});
void refreshSession();
