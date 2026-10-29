import type {ChangeFeedProjection,ChangeFilter} from '../model/changes';
import {createChangeCardList} from './change-cards';

export type ChangesPanelData=Readonly<{feed:ChangeFeedProjection;filter:ChangeFilter;status:'idle'|'loading'|'ready'|'error';error:string|null;loadingMore:boolean;hasMore:boolean;canMark:boolean}>;

/** The Changes view: every retained save, newest first, filtered by who made it, with Undo per save. */
export function createChangesPanel(document:Document,root:HTMLElement,callbacks:{filter(value:ChangeFilter):void;undo(operationId:string):void;markReviewed():void;loadMore():void;retry():void}){
 const element=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
 // Node#appendChild keeps DOM typing independent of the edge runtime's Element declarations.
 const add=(parent:Node,...children:Node[])=>{for(const child of children)parent.appendChild(child);};
 const toolbar=element('div','','changes-toolbar'),filters=element('div','','segmented');filters.setAttribute('role','group');filters.setAttribute('aria-label','Show changes by');
 const markReviewed=element('button','Mark all as reviewed','outline');markReviewed.type='button';markReviewed.id='markReviewed';markReviewed.onclick=()=>callbacks.markReviewed();
 const filterButtons=new Map<ChangeFilter,HTMLButtonElement>();
 for(const value of ['all','connections','you'] as const){const button=element('button');button.type='button';button.dataset.changeFilter=value;button.onclick=()=>callbacks.filter(value);filterButtons.set(value,button);add(filters,button);}
 add(toolbar,filters,markReviewed);
 const notice=element('p','','changes-notice');notice.setAttribute('role','status');
 const status=element('p','','now-empty'),retry=element('button','Try again','outline');retry.type='button';retry.onclick=()=>callbacks.retry();
 const groupsRoot=element('div','','changes-groups'),more=element('button','Show older changes','outline');more.type='button';more.id='changesMore';more.onclick=()=>callbacks.loadMore();
 add(root,toolbar,notice,status,retry,groupsRoot,more);
 const groups=new Map<string,{node:HTMLElement;list:ReturnType<typeof createChangeCardList>}>();
 return {render(data:ChangesPanelData){
  const labels={all:'All',connections:'AI and apps',you:'You'} as const;
  for(const [value,button] of filterButtons){const label=labels[value]+' · '+data.feed.counts[value];if(button.textContent!==label)button.textContent=label;button.setAttribute('aria-pressed',String(data.filter===value));}
  markReviewed.hidden=!data.canMark;
  notice.hidden=!data.feed.reviewed||!data.feed.unreviewed;notice.textContent=data.feed.unreviewed===1?'1 change from AI or connected apps since you last reviewed.':data.feed.unreviewed+' changes from AI or connected apps since you last reviewed.';
  const empty=data.status==='ready'&&!data.feed.groups.length;
  status.hidden=data.status==='ready'&&!empty;status.textContent=data.status==='error'?(data.error||'Recent changes could not be loaded.'):data.status!=='ready'?'Loading recent changes…':data.filter==='all'?'No saved changes are retained yet.':'No saved changes match this filter.';
  retry.hidden=data.status!=='error';
  const keep=new Set(data.feed.groups.map(group=>group.label));for(const [label,group] of groups)if(!keep.has(label)){group.node.remove();groups.delete(label);}
  let previous:HTMLElement|null=null;
  for(const group of data.feed.groups){
   let entry=groups.get(group.label);
   if(!entry){const node=element('section','','changes-group'),heading=element('h3',group.label,'changes-day'),list=element('div','','change-card-list');add(node,heading,list);entry={node,list:createChangeCardList(document,list,{undo:id=>callbacks.undo(id)})};groups.set(group.label,entry);}
   entry.list.render(group.cards);
   const expected:Element|null=previous?previous.nextElementSibling:groupsRoot.firstElementChild;if(expected!==entry.node)groupsRoot.insertBefore(entry.node,expected);previous=entry.node;
  }
  more.hidden=!data.hasMore||data.status!=='ready';more.disabled=data.loadingMore;more.textContent=data.loadingMore?'Loading…':'Show older changes';
 }};
}
