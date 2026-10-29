import type {ChangeCard} from '../model/changes';

/** Keyed change cards; a card's nodes are reused while its operation stays listed. */
export function createChangeCardList(document:Document,root:HTMLElement,callbacks:{undo(operationId:string):void}){
 const element=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
 // Node#appendChild keeps DOM typing independent of the edge runtime's Element declarations.
 const add=(parent:Node,...children:Node[])=>{for(const child of children)parent.appendChild(child);};
 const cards=new Map<string,{node:HTMLElement;signature:string}>();
 function build(card:ChangeCard){
  const node=element('article','','change-card');node.dataset.operationId=card.operationId;node.dataset.actor=card.actor.kind;
  const header=element('div','','change-card-header'),actor=element('span',card.actor.label,'change-actor');
  add(header,actor,element('span',card.time+' · '+card.countLabel,'muted'));
  if(card.isNew)add(header,element('span','New','change-new'));
  add(node,header);
  if(card.summary!==null){
   const claim=element('div','','change-summary');
   add(claim,element('span','What '+(card.actor.kind==='you'?'you':card.actor.label)+' said it did','change-summary-label'),element('p',card.summary));
   add(node,claim);
  }
  const lines=element('ul','','change-lines');
  for(const line of card.lines){const item=element('li');add(item,element('span',line.verb,'change-verb'),element('strong',line.target));if(line.detail)add(item,element('span',line.detail,'muted'));add(lines,item);}
  if(card.hiddenLines)add(lines,element('li',card.hiddenLines===1?'1 more change':card.hiddenLines+' more changes','muted'));
  add(node,lines);
  const footer=element('div','','change-card-footer');
  if(card.undo.available||card.undo.pending){const undo=element('button',card.undo.pending?'Undoing…':'Undo this save','outline');undo.type='button';undo.dataset.undo=card.operationId;undo.disabled=card.undo.pending;undo.onclick=()=>callbacks.undo(card.operationId);add(footer,undo);}
  if(card.undo.reason&&!card.undo.pending)add(footer,element('p',card.undo.reason,'change-undo-reason'));
  add(node,footer);
  return node;
 }
 return {render(list:readonly ChangeCard[]){
  const keep=new Set(list.map(card=>card.operationId));for(const [id,card] of cards)if(!keep.has(id)){card.node.remove();cards.delete(id);}
  let previous:HTMLElement|null=null;
  for(const card of list){
   const signature=JSON.stringify(card);let entry=cards.get(card.operationId);
   if(!entry||entry.signature!==signature){const node=build(card);if(entry)entry.node.replaceWith(node);entry={node,signature};cards.set(card.operationId,entry);}
   const expected:Element|null=previous?previous.nextElementSibling:root.firstElementChild;
   if(expected!==entry.node)root.insertBefore(entry.node,expected);
   previous=entry.node;
  }
 }};
}
