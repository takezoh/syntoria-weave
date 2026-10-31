import {iconSvg} from '../model/icons';
import type {FeedbackProjection,FeedbackPane,RecoveryItem} from '../model/feedback';
/** Stable feedback nodes render data-only projections without remounting editor fields. */
export function createContextualFeedback(document:Document,hosts:Record<FeedbackPane,HTMLElement>,buttons:readonly HTMLButtonElement[],callbacks:{undo(id:number,undoOf:string):void;dismiss(id:number):void;dismissAdvisory(id:number):void;toggle():void;open(target:RecoveryItem['target']):void;check():void;retry():void;refresh():void;retryDraft(id:string):void}){
 const make=(tag:string,id:string)=>{const node=document.createElement(tag);node.id=id;return node;};
 const block=(id:string)=>{const node=make('section',id);node.className='contextual-feedback';node.hidden=true;return node;};
 const control=(id:string,label:string,callback:()=>void)=>{const node=make('button',id) as HTMLButtonElement;node.type='button';node.textContent=label;node.onclick=callback;return node;};
 const iconControl=(id:string,label:string,icon:string,callback:()=>void)=>{const node=control(id,label,callback);node.className='icon-button';node.setAttribute('aria-label',label);node.title=label;node.innerHTML=iconSvg(icon);return node;};
 const notice=block('operationNotice'),text=make('p','noticeText'),undo=iconControl('undo','Undo','undo',()=>{if(noticeId!==null&&undoTarget)callbacks.undo(noticeId,undoTarget);}),dismiss=iconControl('dismissNotice','Dismiss','close',()=>{if(noticeId!==null)callbacks.dismiss(noticeId);});text.setAttribute('role','status');text.setAttribute('aria-live','polite');notice.appendChild(text);notice.appendChild(undo);notice.appendChild(dismiss);
 const advisory=block('advisoryNotice'),advisoryText=make('p','advisoryText'),dismissAdvisory=iconControl('dismissAdvisory','Dismiss','close',()=>{if(advisoryId!==null)callbacks.dismissAdvisory(advisoryId);});advisoryText.setAttribute('role','status');advisory.appendChild(advisoryText);advisory.appendChild(dismissAdvisory);
 const recovery=block('recoveryPanel'),heading=make('h3','recoveryHeading'),retained=make('div','retained');heading.textContent='Retained changes';recovery.setAttribute('aria-label','Recovery');recovery.appendChild(heading);recovery.appendChild(retained);
 const unknown=block('unknown'),unknownText=make('p','unknownText'),check=control('check','Check result',callbacks.check),retry=control('retry','Retry same request',callbacks.retry);unknownText.textContent='The save result is unknown. Your input and exact request are retained.';unknownText.setAttribute('role','status');unknown.appendChild(unknownText);unknown.appendChild(check);unknown.appendChild(retry);
 const failure=block('operationFailure'),failureText=make('p','operationFailureText');failureText.setAttribute('role','status');failure.appendChild(failureText);
 const refresh=control('recoveryRefresh','Refresh',callbacks.refresh);failure.appendChild(refresh);
 const local=block('localSaveFeedback'),localText=make('span','localSaveText'),retryDraft=control('retryDraft','Retry changes',()=>{if(retryId)callbacks.retryDraft(retryId);});localText.setAttribute('role','status');localText.setAttribute('aria-live','polite');local.appendChild(localText);local.appendChild(retryDraft);let retryId:string|null=null;
 const rows=new Map<string,HTMLButtonElement>();let noticeId:number|null=null,advisoryId:number|null=null,undoTarget:string|null=null;
 const place=(node:HTMLElement,pane:FeedbackPane)=>{if(node.parentElement!==hosts[pane])hosts[pane].appendChild(node);};
 for(const node of [notice,advisory,recovery,unknown,failure,local])hosts.list.appendChild(node);
 for(const button of buttons)button.onclick=callbacks.toggle;
 const setText=(node:HTMLElement,value:string)=>{if(node.textContent!==value)node.textContent=value;};
 return {render(view:FeedbackProjection){
  for(const button of buttons){button.hidden=!view.count;button.setAttribute('aria-expanded',String(view.recoveryOpen));button.setAttribute('aria-label',`Retained changes (${view.count})`);button.title=`Retained changes (${view.count})`;}
  noticeId=view.notice?.id??null;undoTarget=view.notice?.undoOf??null;notice.hidden=!view.notice;if(view.notice){place(notice,view.notice.pane);notice.dataset.noticeId=String(view.notice.id);setText(text,view.notice.text);undo.hidden=!view.notice.undoOf;undo.disabled=view.notice.undoDisabled;}
  advisoryId=view.advisory?.id??null;advisory.hidden=!view.advisory;if(view.advisory){place(advisory,view.advisory.pane);setText(advisoryText,view.advisory.text);}
  unknown.hidden=!view.unknown;place(unknown,view.unknownPane);check.disabled=view.checkDisabled;retry.disabled=view.checkDisabled;
  failure.hidden=!view.failure&&!view.recoveryRequired;place(failure,view.failurePane);setText(failureText,view.failure||'Refresh before saving more changes.');refresh.hidden=!view.recoveryRequired;
  recovery.hidden=!view.recoveryOpen;place(recovery,view.recoveryPane);const keys=new Set(view.recovery.map(row=>row.key));for(const [key,node] of rows)if(!keys.has(key)){node.remove();rows.delete(key);}for(const item of view.recovery){let node=rows.get(item.key);if(!node){node=control('',item.label,()=>callbacks.open(item.target));node.dataset.recoveryKey=item.key;node.dataset.focusKey='retained:'+item.target.id;rows.set(item.key,node);retained.appendChild(node);}setText(node,item.label);}
  local.hidden=!view.local;if(view.local){place(local,view.local.pane);setText(localText,view.local.text);retryId=view.local.retryId;retryDraft.hidden=!retryId;}
 }};
}
