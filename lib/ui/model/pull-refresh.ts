/** Gesture decisions are independent of touch events and layout effects. */
export type PullState=Readonly<{phase:'pending'|'pulling'|'canceled';distance:number}>;
export const PULL_THRESHOLD=64;
export function movePull(state:PullState,dx:number,dy:number):PullState {
 if(state.phase==='canceled')return state;
 if(state.phase==='pending'){
  if(Math.hypot(dx,dy)<10)return state;
  if(dy<=0||dy<Math.abs(dx)*1.5)return {phase:'canceled',distance:0};
 }
 return {phase:'pulling',distance:Math.min(96,Math.max(0,dy*.5))};
}
export function releasePull(state:PullState):boolean{return state.phase==='pulling'&&state.distance>=PULL_THRESHOLD;}
