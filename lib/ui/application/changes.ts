import type {RecentChangeItem} from '../../data/types';
import type {ReviewMarkPort} from '../ports';
import {validRecentChangePage,type ChangeFilter} from '../model/changes';

export type ChangesState=Readonly<{
 status:'idle'|'loading'|'ready'|'error';
 items:readonly RecentChangeItem[];
 headRevision:number|null;
 nextBeforeRevision:number|null;
 loadingMore:boolean;
 error:string|null;
 filter:ChangeFilter;
 /** The newest revision the person marked as reviewed in this browser; null before the first mark. */
 reviewedThrough:number|null;
}>;

export const RECENT_CHANGE_PAGE=20;

/**
 * Recent-change reads for the review views. Reads never write; only markReviewed changes the review
 * mark, through its port. A response for an older request never replaces a newer one.
 */
export function createChangesController({call,reviewMarks,changed}:{call(name:string,args:unknown):Promise<unknown>;reviewMarks:ReviewMarkPort;changed():void}) {
 let state:ChangesState={status:'idle',items:[],headRevision:null,nextBeforeRevision:null,loadingMore:false,error:null,filter:'all',reviewedThrough:reviewMarks.read()};
 let loadedRevision:number|null=null,sequence=0;
 const update=(patch:Partial<ChangesState>)=>{state=Object.freeze({...state,...patch});changed();};
 async function load(revision:number){
  const request=++sequence;loadedRevision=revision;update({status:state.items.length?state.status:'loading',error:null,loadingMore:false});
  try{
   const page=await call('list_recent_changes',{limit:RECENT_CHANGE_PAGE});
   if(request!==sequence)return;
   if(!validRecentChangePage(page))throw new Error('The change history could not be verified.');
   // A mark beyond the head belongs to another account or an earlier timeline in this browser; ignore it.
   const reviewedThrough=state.reviewedThrough!==null&&state.reviewedThrough>page.head_revision?null:state.reviewedThrough;
   update({status:'ready',items:Object.freeze([...page.changes]),headRevision:page.head_revision,nextBeforeRevision:page.next_before_revision,error:null,reviewedThrough});
  }catch(error){
   if(request!==sequence)return;
   loadedRevision=null;update({status:'error',error:error instanceof Error?error.message:String(error)});
  }
 }
 return {
  get state(){return state;},
  /** Reload when a review view is visible and the confirmed revision differs from the loaded one. */
  sync(revision:number|null,active:boolean){if(active&&revision!==null&&revision!==loadedRevision)void load(revision);},
  retry(revision:number|null){if(revision!==null)void load(revision);},
  async loadMore(){
   const before=state.nextBeforeRevision;if(before===null||state.loadingMore||state.status!=='ready')return;
   const request=sequence;update({loadingMore:true});
   try{
    const page=await call('list_recent_changes',{before_revision:before,limit:RECENT_CHANGE_PAGE});
    if(request!==sequence)return;
    if(!validRecentChangePage(page))throw new Error('The change history could not be verified.');
    const known=new Set(state.items.map(item=>item.operation_id));
    update({items:Object.freeze([...state.items,...page.changes.filter(item=>!known.has(item.operation_id))]),nextBeforeRevision:page.next_before_revision,loadingMore:false});
   }catch(error){if(request===sequence)update({loadingMore:false,error:error instanceof Error?error.message:String(error)});}
  },
  setFilter(filter:ChangeFilter){if(filter!==state.filter)update({filter});},
  /** Mark everything up to the loaded head as reviewed. This records the person's choice only in this browser. */
  markReviewed(){const head=state.headRevision;if(head===null||head===state.reviewedThrough)return;reviewMarks.write(head);update({reviewedThrough:head});},
 };
}
export type ChangesController=ReturnType<typeof createChangesController>;
