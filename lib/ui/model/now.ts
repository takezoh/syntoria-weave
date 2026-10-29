import {displayTitle} from './presentation';

/** One Action shown on the Now view: identity, display title and a plain-language context line. */
export interface NowRow {id:string;title:string;meta:string;waiting:boolean;overdue:boolean}
export interface NowProjection {inboxCount:number;flaggedCount:number;flagged:readonly NowRow[];deadlines:readonly NowRow[]}
export interface NowAction {id:string;title:string;status:string;due_at?:string|null;project_id?:string|null;project_path?:string|null;view?:string;defer_until?:string|null;is_deferred?:boolean}
export interface NowSnapshot {actions:readonly NowAction[];list_scopes?:Readonly<Record<string,readonly string[]>>}

export const DEADLINE_WINDOW_DAYS=7;
const DAY_MS=86_400_000;

function place(action:NowAction):string {return action.project_path||(action.project_id?'Project':'Inbox');}

/**
 * Deterministic Now content from the confirmed snapshot and an explicit read time: flagged normal-view
 * Actions in saved order, and unfinished Actions whose deadline passed or falls within the next seven days.
 * Nothing here ranks, recommends or hides Actions; every list links back to the complete saved lists.
 */
export function projectNow(snapshot:NowSnapshot,input:{now:number;formatDay:(value:string)=>string}):NowProjection {
 const byId=new Map(snapshot.actions.map(action=>[action.id,action] as const));
 const unfinished=(action:NowAction)=>action.status==='active'||action.status==='on-hold';
 const flagged=(snapshot.list_scopes?.flagged??[]).map(id=>byId.get(id)).filter((action):action is NowAction=>Boolean(action)).map(action=>({
  id:action.id,title:displayTitle(action.title),waiting:action.status==='on-hold',overdue:false,
  meta:[place(action),action.status==='on-hold'?'Waiting':'',action.due_at?'Deadline '+input.formatDay(action.due_at):''].filter(Boolean).join(' · '),
 }));
 const limit=input.now+DEADLINE_WINDOW_DAYS*DAY_MS;
 const deadlines=snapshot.actions.filter(action=>unfinished(action)&&typeof action.due_at==='string'&&Date.parse(action.due_at)<=limit)
  .sort((left,right)=>left.due_at===right.due_at?(left.id<right.id?-1:left.id>right.id?1:0):left.due_at!<right.due_at!?-1:1)
  .map(action=>{const overdue=Date.parse(action.due_at!)<input.now;return {
   id:action.id,title:displayTitle(action.title),waiting:action.status==='on-hold',overdue,
   meta:[(overdue?'Overdue · ':'')+input.formatDay(action.due_at!),place(action),action.status==='on-hold'?'Waiting':'',action.is_deferred?'Hidden for now':''].filter(Boolean).join(' · '),
  };});
 return {inboxCount:(snapshot.list_scopes?.inbox??[]).length,flaggedCount:flagged.length,flagged,deadlines};
}

export const MAX_CAPTURE_TITLE_LENGTH=200;
/**
 * The title for text saved from the Now capture box: its first line with visible text, trimmed and cut
 * to the title limit without splitting a surrogate pair. The complete text is saved exactly as Notes.
 */
export function captureTitle(text:string):string {
 const line=text.split(/\r\n|\r|\n/u).map(value=>value.trim()).find(Boolean)??'';
 if(line.length<=MAX_CAPTURE_TITLE_LENGTH)return line;
 let cut=MAX_CAPTURE_TITLE_LENGTH-1;
 const code=line.charCodeAt(cut-1);if(code>=0xd800&&code<=0xdbff)cut--;
 return line.slice(0,cut).trimEnd()+'…';
}
