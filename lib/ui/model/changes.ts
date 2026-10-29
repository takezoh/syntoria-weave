import type {Action,ActorRef,RecentChangeItem} from '../../data/types';
import {displayTitle} from './presentation';

export type ChangeFilter='all'|'connections'|'you';
export type ChangeActor=Readonly<{kind:'you'|'connection'|'unknown';label:string}>;
export type ChangeLine=Readonly<{verb:string;target:string;detail:string}>;
export type ChangeCard=Readonly<{
 operationId:string;revision:number;actor:ChangeActor;time:string;countLabel:string;
 /** The writer's own description, displayed as its claim beside the actual changes. */
 summary:string|null;lines:readonly ChangeLine[];hiddenLines:number;
 undo:Readonly<{available:boolean;pending:boolean;reason:string}>;isNew:boolean;
}>;
export type ChangeGroup=Readonly<{label:string;cards:readonly ChangeCard[]}>;
export type ChangeFeedProjection=Readonly<{groups:readonly ChangeGroup[];counts:Readonly<{all:number;connections:number;you:number}>;unreviewed:number;reviewed:boolean}>;
export type ChangeNames=Readonly<{project(id:string|null):string;tag(id:string):string;action(id:string|null):string}>;

const MAX_LINES=6;

/** "You" is the person in the dedicated app; a connection is an AI or other app acting for them. */
export function changeActor(item:Pick<RecentChangeItem,'actor_kind'|'client_name'>):ChangeActor {
 if(item.actor_kind==='user')return {kind:'you',label:'You'};
 if(item.actor_kind==='client')return {kind:'connection',label:item.client_name??'Connected app'};
 return {kind:'unknown',label:'Unknown source'};
}

/** A provenance reference for display; null means it was saved before provenance was recorded. */
export function actorLabel(ref:(ActorRef&{client_name?:string|null})|null|undefined):string|null {
 if(!ref)return null;
 return ref.kind==='user'?'you':ref.client_name??'a connected app';
}

function statusLine(before:Action['status'],after:Action['status']):string {
 if(after==='completed')return 'Completed';
 if(after==='dropped')return 'Dropped';
 if(after==='on-hold')return 'Marked waiting';
 return before==='on-hold'?'No longer waiting':'Reopened';
}

function actionLines(before:Action|null,after:Action|null,names:ChangeNames,formatTime:(value:string)=>string):ChangeLine[] {
 const target=displayTitle((after??before)!.title);
 if(!before)return [{verb:'Added',target,detail:after!.parent_id?'inside '+names.action(after!.parent_id):'to '+(after!.project_id?names.project(after!.project_id):'Inbox')}];
 if(!after)return [{verb:'Removed',target,detail:''}];
 const lines:ChangeLine[]=[];
 if(before.status!==after.status)lines.push({verb:statusLine(before.status,after.status),target,detail:''});
 if(before.title!==after.title)lines.push({verb:'Renamed',target,detail:'was “'+displayTitle(before.title)+'”'});
 if(before.notes!==after.notes)lines.push({verb:'Edited notes',target,detail:''});
 if(before.flagged!==after.flagged)lines.push({verb:after.flagged?'Flagged':'Unflagged',target,detail:''});
 if(before.due_at!==after.due_at)lines.push(after.due_at?{verb:before.due_at?'Changed deadline':'Set deadline',target,detail:formatTime(after.due_at)}:{verb:'Cleared deadline',target,detail:''});
 if(before.defer_until!==after.defer_until)lines.push(after.defer_until?{verb:'Hid until',target,detail:formatTime(after.defer_until)}:{verb:'Showed again',target,detail:''});
 if(before.project_id!==after.project_id)lines.push({verb:'Moved',target,detail:'to '+(after.project_id?names.project(after.project_id):'Inbox')});
 if(before.parent_id!==after.parent_id)lines.push({verb:'Moved',target,detail:after.parent_id?'inside '+names.action(after.parent_id):'to the top level'});
 else if(before.order!==after.order&&!lines.length)lines.push({verb:'Reordered',target,detail:''});
 if(before.metadata!==after.metadata&&!lines.length)lines.push({verb:'Updated app data for',target,detail:''});
 return lines;
}

function catalogLines(kind:'project'|'tag'|'perspective',before:{name:string;parent_id?:string|null;description?:string}|null,after:{name:string;parent_id?:string|null;description?:string}|null):ChangeLine[] {
 const noun=kind==='project'?'project':kind==='tag'?'tag':'perspective',target=(after??before)!.name;
 if(!before)return [{verb:'Added '+noun,target,detail:''}];
 if(!after)return [{verb:'Removed '+noun,target,detail:''}];
 if(before.name!==after.name)return [{verb:'Renamed '+noun,target,detail:'was “'+before.name+'”'}];
 if((before.parent_id??null)!==(after.parent_id??null))return [{verb:'Moved '+noun,target,detail:''}];
 return [{verb:'Edited '+noun,target,detail:''}];
}

/** Plain-language lines derived only from the persisted before/after records of one operation. */
export function describeChange(item:RecentChangeItem,names:ChangeNames,formatTime:(value:string)=>string):ChangeLine[] {
 const lines:ChangeLine[]=[];
 if(item.undo_of)lines.push({verb:'Undid',target:'an earlier save',detail:''});
 for(const row of item.changes.actions)lines.push(...actionLines(row.before,row.after,names,formatTime));
 for(const row of item.changes.action_tags){const ref=(row.after??row.before)!;lines.push({verb:row.after?'Tagged':'Untagged',target:names.action(ref.action_id),detail:names.tag(ref.tag_id)});}
 for(const row of item.changes.projects)lines.push(...catalogLines('project',row.before,row.after));
 for(const row of item.changes.tags)lines.push(...catalogLines('tag',row.before,row.after));
 for(const row of item.changes.perspectives)lines.push(...catalogLines('perspective',row.before,row.after));
 if(!lines.length)lines.push(item.collaboration_id?{verb:'Updated',target:'AI collaboration records',detail:''}:{verb:'Saved',target:'without changes',detail:''});
 return lines;
}

function undoState(item:RecentChangeItem,pending:string|null,blocked:boolean) {
 const status=item.undo.status;
 if(pending===item.operation_id)return {available:false,pending:true,reason:'Undoing…'};
 if(status==='available')return {available:!blocked,pending:false,reason:blocked?'Finish the pending save before undoing.':''};
 if(status==='undone')return {available:false,pending:false,reason:'Already undone.'};
 if(status==='conflict')return {available:false,pending:false,reason:'Can’t undo: a later change to the same item would be lost.'};
 return {available:false,pending:false,reason:item.undo_of?'This save was itself an Undo.':item.collaboration_id?'Collaboration records change through their own decisions.':'This save can’t be undone.'};
}

/** A connection change is new when it was committed after the review mark this browser saved. */
export function isUnreviewed(item:Pick<RecentChangeItem,'actor_kind'|'revision_after'>,reviewedThrough:number|null):boolean {
 return reviewedThrough!==null&&item.actor_kind==='client'&&item.revision_after>reviewedThrough;
}

export function projectChangeFeed(input:{items:readonly RecentChangeItem[];filter:ChangeFilter;reviewedThrough:number|null;names:ChangeNames;formatTime:(value:string)=>string;formatClock:(value:string)=>string;dayLabel:(value:string)=>string;pendingUndo:string|null;blocked:boolean;limit?:number}):ChangeFeedProjection {
 const counts={all:input.items.length,connections:input.items.filter(item=>item.actor_kind==='client').length,you:input.items.filter(item=>item.actor_kind==='user').length};
 const shown=input.items.filter(item=>input.filter==='all'||(input.filter==='connections'?item.actor_kind==='client':item.actor_kind==='user')).slice(0,input.limit??Infinity);
 const groups:{label:string;cards:ChangeCard[]}[]=[];
 for(const item of shown){
  const lines=describeChange(item,input.names,input.formatTime),entities=item.changes.actions.length+item.changes.action_tags.length+item.changes.projects.length+item.changes.tags.length+item.changes.perspectives.length;
  const card:ChangeCard={operationId:item.operation_id,revision:item.revision_after,actor:changeActor(item),time:input.formatClock(item.committed_at),countLabel:entities===1?'1 change':entities+' changes',
   summary:item.summary,lines:lines.slice(0,MAX_LINES),hiddenLines:Math.max(0,lines.length-MAX_LINES),undo:undoState(item,input.pendingUndo,input.blocked),isNew:isUnreviewed(item,input.reviewedThrough)};
  const label=input.dayLabel(item.committed_at),last=groups.at(-1);
  if(last?.label===label)last.cards.push(card);else groups.push({label,cards:[card]});
 }
 return {groups,counts,unreviewed:input.items.filter(item=>isUnreviewed(item,input.reviewedThrough)).length,reviewed:input.reviewedThrough!==null};
}

/** Lookups from the confirmed snapshot, falling back to neutral words for records no longer present. */
export function changeNames(snapshot:{actions:readonly {id:string;title:string}[];projects?:readonly {id:string;name:string;path?:string}[];tags?:readonly {id:string;name:string;path?:string}[]}|null):ChangeNames {
 const actions=new Map((snapshot?.actions??[]).map(row=>[row.id,row.title] as const)),projects=new Map((snapshot?.projects??[]).map(row=>[row.id,row.path??row.name] as const)),tags=new Map((snapshot?.tags??[]).map(row=>[row.id,row.path??row.name] as const));
 return {
  action:id=>id&&actions.has(id)?displayTitle(actions.get(id)!):'another action',
  project:id=>id&&projects.has(id)?projects.get(id)!:'a project',
  tag:id=>tags.get(id)??'a tag',
 };
}

/** Accept only the documented recent-change page shape before it replaces the visible feed. */
export function validRecentChangePage(value:unknown):value is {head_revision:number;next_before_revision:number|null;changes:RecentChangeItem[]} {
 const page=value as {head_revision?:unknown;next_before_revision?:unknown;changes?:unknown}|null;
 if(!page||!Number.isSafeInteger(page.head_revision)||!(page.next_before_revision===null||Number.isSafeInteger(page.next_before_revision))||!Array.isArray(page.changes))return false;
 return page.changes.every(item=>{const row=item as Partial<RecentChangeItem>|null;return Boolean(row&&typeof row.operation_id==='string'&&Number.isSafeInteger(row.revision_after)&&typeof row.committed_at==='string'&&row.changes&&['actions','projects','tags','perspectives','action_tags'].every(key=>Array.isArray((row.changes as Record<string,unknown>)[key]))&&row.undo&&['available','conflict','undone','not_undoable'].includes(row.undo.status));});
}
