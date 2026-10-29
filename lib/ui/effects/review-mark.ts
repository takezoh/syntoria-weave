import type {ReviewMarkPort} from '../ports';

const KEY='action-tools.review-mark.v1';

/**
 * Browser storage for the review mark. Storage can be absent or throw in sandboxed host frames, private
 * windows or with blocked site data; the mark then lasts only for this loaded UI.
 */
export function createReviewMarkStore(storage:() => Storage|null):ReviewMarkPort {
 let memory:number|null=null;
 return {
  read(){
   try{const value=JSON.parse(storage()?.getItem(KEY)??'null') as {revision?:unknown}|null;if(value&&Number.isSafeInteger(value.revision)&&Number(value.revision)>=0){memory=Number(value.revision);return memory;}}catch{}
   return memory;
  },
  write(revision){memory=revision;try{storage()?.setItem(KEY,JSON.stringify({revision}));}catch{}},
 };
}
