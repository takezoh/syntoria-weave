import {movePull,releasePull,PULL_THRESHOLD} from '../model/pull-refresh';
import type {PullState} from '../model/pull-refresh';

/** One read lane for explicit refresh and foreground recovery; never reloads the document. */
export function installRefresh(document:Document,window:Window,options:{
 scroller:HTMLElement;indicator:HTMLElement;button:HTMLButtonElement;
 refresh:()=>Promise<unknown>;blocked:()=>boolean;pullAllowed:()=>boolean;
 claimPull:()=>void;message:(text:string)=>void;
}){
 let ready=false,disposed=false,pending=false,inFlight:Promise<void>|null=null;
 let foreground=document.visibilityState!=='hidden';
 let pull:{id:number;x:number;y:number;state:PullState}|null=null;
 const {scroller,indicator,button}=options;
 const draw=(distance=0,text='')=>{const transform=`translateY(${distance-40}px)`;if(indicator.style.transform!==transform)indicator.style.transform=transform;if(indicator.textContent!==text)indicator.textContent=text;if(indicator.hidden!==(distance===0))indicator.hidden=distance===0;};
 function cancel(){scroller.removeEventListener('touchmove',move);pull=null;if(!inFlight)draw();}
 function request():Promise<void>{
  if(disposed)return Promise.resolve();
  if(inFlight)return inFlight;
  if(!ready||options.blocked()){pending=true;return Promise.resolve();}
  pending=false;button.dataset.refreshing='true';button.setAttribute('aria-busy','true');draw(40,'Refreshing…');
  inFlight=Promise.resolve().then(options.refresh).then(()=>{if(!disposed)options.message('Up to date.');},()=>{if(!disposed)options.message('Could not refresh. Your input is retained. Pull down or use Refresh to retry.');}).finally(()=>{
   inFlight=null;delete button.dataset.refreshing;button.setAttribute('aria-busy',String(button.dataset.saving==='true'));draw();
  });
  return inFlight;
 }
 const active=()=>{if(document.visibilityState==='hidden')return;if(!foreground){foreground=true;void request();}};
 const inactive=()=>{foreground=false;cancel();};
 const visibility=()=>document.visibilityState==='hidden'?inactive():active();
 const pageShow=()=>active();
 const start=(event:TouchEvent)=>{
  cancel();if(event.touches.length!==1||!ready||inFlight||options.blocked()||!options.pullAllowed()||scroller.scrollTop>0)return;
  const target=event.target as Element|null;
  if(target?.closest('input,textarea,select,[contenteditable="true"],dialog,.popover,.complete,.flag'))return;
  const touch=event.touches[0];pull={id:touch.identifier,x:touch.clientX,y:touch.clientY,state:{phase:'pending',distance:0}};
  scroller.addEventListener('touchmove',move,{passive:false});
 };
 const move=(event:TouchEvent)=>{
  if(!pull)return;
  if(event.touches.length!==1||options.blocked()||!options.pullAllowed()){cancel();return;}
  const touch=Array.from(event.touches).find(t=>t.identifier===pull!.id);if(!touch){cancel();return;}
  const next=movePull(pull.state,touch.clientX-pull.x,touch.clientY-pull.y);
  if(next.phase==='canceled'){cancel();return;}
  if(next.phase==='pulling'){
   if(!event.cancelable){cancel();return;}
   event.preventDefault();if(pull.state.phase!=='pulling')options.claimPull();
   draw(next.distance,next.distance>=PULL_THRESHOLD?'Release to refresh':'Pull down to refresh');
  }
  pull.state=next;
 };
 const end=()=>{const refresh=pull&&releasePull(pull.state);if(pull?.state.phase==='pulling')options.claimPull();cancel();if(refresh)void request();};
 const click=()=>{void request();};
 button.addEventListener('click',click);
 scroller.addEventListener('touchstart',start,{passive:true});
 scroller.addEventListener('touchend',end);scroller.addEventListener('touchcancel',cancel);
 document.addEventListener('visibilitychange',visibility);window.addEventListener('focus',active);window.addEventListener('blur',inactive);window.addEventListener('pageshow',pageShow);window.addEventListener('pagehide',inactive);
 return {request,start(){ready=true;return request();},flush(){if(pending&&!options.blocked())void request();},dispose(){disposed=true;cancel();button.removeEventListener('click',click);scroller.removeEventListener('touchstart',start);scroller.removeEventListener('touchmove',move);scroller.removeEventListener('touchend',end);scroller.removeEventListener('touchcancel',cancel);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',active);window.removeEventListener('blur',inactive);window.removeEventListener('pageshow',pageShow);window.removeEventListener('pagehide',inactive);}};
}
