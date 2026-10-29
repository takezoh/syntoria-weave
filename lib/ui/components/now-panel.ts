import type {ChangeCard} from '../model/changes';
import type {NowRow} from '../model/now';
import {createChangeCardList} from './change-cards';

export type NowPanelData=Readonly<{
 capture:Readonly<{text:string;disabled:boolean;canSave:boolean}>;
 attention:Readonly<{count:number}>;
 digest:Readonly<{status:'idle'|'loading'|'ready'|'error';error:string|null;cards:readonly ChangeCard[];unreviewed:number;reviewed:boolean;canMark:boolean}>;
 flagged:readonly NowRow[];flaggedCount:number;deadlines:readonly NowRow[];mutationBlocked:boolean;
}>;
export type NowPanelCallbacks=Readonly<{captureInput(text:string):void;capture():void;open(id:string):void;complete(id:string):void;navigate(view:string):void;undo(operationId:string):void;markReviewed():void;retryChanges():void}>;

/**
 * The Now view: capture, what waits on the person, recent connection changes, flags and deadlines.
 * It renders model data only; `attentionRoot` is where the composition mounts the collaboration panel.
 */
export function createNowPanel(document:Document,root:HTMLElement,callbacks:NowPanelCallbacks){
 const element=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
 // Node#appendChild keeps DOM typing independent of the edge runtime's Element declarations.
 const add=(parent:Node,...children:Node[])=>{for(const child of children)parent.appendChild(child);};
 const section=(id:string,title:string)=>{const node=element('section','','now-card');node.setAttribute('aria-labelledby',id);const header=element('div','','now-card-header'),heading=element('h3',title);heading.id=id;add(header,heading);add(node,header);return {node,header,heading};};

 const capture=element('section','','now-card now-capture');capture.setAttribute('aria-labelledby','nowCaptureLabel');
 const captureLabel=element('label','Get it out of your head');captureLabel.id='nowCaptureLabel';captureLabel.htmlFor='nowCapture';
 const captureInput=element('textarea');captureInput.id='nowCapture';captureInput.rows=2;captureInput.maxLength=65536;captureInput.dataset.focusKey='now:capture';captureInput.placeholder='Write it as it is — a task, a worry, a link. Your AI can sort it out later.';
 const captureRow=element('div','','now-capture-row'),captureHint=element('p','Saved to Inbox exactly as written. No date, project or decision needed.','muted'),captureSave=element('button','Save to Inbox','primary');captureSave.type='button';captureSave.id='nowCaptureSave';
 add(captureRow,captureHint,captureSave);add(capture,captureLabel,captureInput,captureRow);
 captureInput.addEventListener('input',()=>callbacks.captureInput(captureInput.value));
 captureInput.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.metaKey||event.ctrlKey)&&!event.isComposing){event.preventDefault();callbacks.capture();}});
 captureSave.onclick=()=>callbacks.capture();

 const columns=element('div','','now-columns'),left=element('div','','now-column'),right=element('div','','now-column');add(columns,left,right);

 const attention=section('nowAttentionHeading','Waiting on you'),attentionCount=element('span','','count-pill attention'),attentionEmpty=element('p','Nothing is waiting on you. Proposals and questions from your AI appear here.','now-empty');
 const attentionRoot=element('div','','now-attention');attentionRoot.id='nowAttention';add(attention.header,attentionCount);add(attention.node,attentionEmpty,attentionRoot);

 const digest=section('nowDigestHeading','Changed by AI and connected apps'),digestMeta=element('span','','muted'),digestStatus=element('p','','now-empty'),digestList=element('div','','change-card-list'),digestFooter=element('div','','now-card-footer');
 const reviewAll=element('button','Review all changes','link-button');reviewAll.type='button';reviewAll.onclick=()=>callbacks.navigate('changes');
 const markReviewed=element('button','Mark as reviewed','outline');markReviewed.type='button';markReviewed.onclick=()=>callbacks.markReviewed();
 const retry=element('button','Try again','outline');retry.type='button';retry.onclick=()=>callbacks.retryChanges();
 add(digest.header,digestMeta);add(digestFooter,reviewAll,markReviewed,retry);add(digest.node,digestStatus,digestList,digestFooter);
 const digestCards=createChangeCardList(document,digestList,{undo:id=>callbacks.undo(id)});

 const flagged=section('nowFlaggedHeading','Flagged'),flaggedAll=element('button','See all','link-button'),flaggedList=element('ul','','now-rows'),flaggedEmpty=element('p','No flagged actions. Flag what deserves attention and it shows up here.','now-empty');
 flaggedAll.type='button';flaggedAll.onclick=()=>callbacks.navigate('flagged');add(flagged.header,flaggedAll);add(flagged.node,flaggedEmpty,flaggedList);

 const deadlines=section('nowDeadlinesHeading','Deadlines in the next 7 days'),deadlineList=element('ul','','now-rows'),deadlineEmpty=element('p','No deadlines in the next 7 days.','now-empty'),deadlineNote=element('p','Listed by date only. Your AI can suggest what to do first when you ask.','now-note');
 add(deadlines.node,deadlineEmpty,deadlineList,deadlineNote);

 add(left,attention.node,digest.node);add(right,flagged.node,deadlines.node);add(root,capture,columns);

 const rowNodes=new WeakMap<HTMLUListElement,Map<string,{node:HTMLElement;signature:string}>>();
 function renderRows(list:HTMLUListElement,rows:readonly NowRow[],blocked:boolean){
  let nodes=rowNodes.get(list);if(!nodes){nodes=new Map();rowNodes.set(list,nodes);}
  const keep=new Set(rows.map(row=>row.id));for(const [id,entry] of nodes)if(!keep.has(id)){entry.node.remove();nodes.delete(id);}
  let previous:HTMLElement|null=null;
  for(const row of rows){
   const signature=JSON.stringify([row,blocked]);let entry=nodes.get(row.id);
   if(!entry||entry.signature!==signature){
    const node=element('li','','now-row'+(row.overdue?' overdue':''));node.dataset.actionId=row.id;
    const complete=element('button','','complete');complete.type='button';complete.setAttribute('aria-label','Complete '+row.title);complete.dataset.complete=row.id;complete.disabled=blocked;complete.innerHTML=row.waiting?'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/></svg>':'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/></svg>';complete.onclick=()=>callbacks.complete(row.id);
    const open=element('button','','now-row-open');open.type='button';open.dataset.open=row.id;add(open,element('span',row.title,'now-row-title'),element('span',row.meta,'now-row-meta'));open.onclick=()=>callbacks.open(row.id);
    add(node,complete,open);if(entry)entry.node.replaceWith(node);entry={node,signature};nodes.set(row.id,entry);
   }
   const expected:Element|null=previous?previous.nextElementSibling:list.firstElementChild;if(expected!==entry.node)list.insertBefore(entry.node,expected);previous=entry.node;
  }
 }

 return {attentionRoot,render(data:NowPanelData){
  if(captureInput.value!==data.capture.text&&document.activeElement!==captureInput)captureInput.value=data.capture.text;
  captureInput.disabled=data.capture.disabled;captureSave.disabled=data.capture.disabled||!data.capture.canSave;
  attentionCount.textContent=String(data.attention.count);attentionCount.hidden=!data.attention.count;attentionEmpty.hidden=data.attention.count>0;attentionRoot.hidden=!data.attention.count;
  const {status,error,cards,unreviewed,reviewed,canMark}=data.digest;
  digestMeta.textContent=reviewed?(unreviewed===1?'1 new since you last reviewed':unreviewed+' new since you last reviewed'):'Most recent';
  digestStatus.hidden=status==='ready'&&cards.length>0;
  digestStatus.textContent=status==='error'?(error||'Recent changes could not be loaded.'):status!=='ready'?'Loading recent changes…':reviewed?'Nothing new from your connections since you last reviewed.':'No changes from AI or connected apps yet.';
  digestCards.render(status==='ready'?cards:[]);
  retry.hidden=status!=='error';markReviewed.hidden=!canMark;
  flaggedEmpty.hidden=data.flagged.length>0;flaggedAll.hidden=!data.flaggedCount;renderRows(flaggedList,data.flagged,data.mutationBlocked);
  deadlineEmpty.hidden=data.deadlines.length>0;deadlineNote.hidden=!data.deadlines.length;renderRows(deadlineList,data.deadlines,data.mutationBlocked);
 }};
}
