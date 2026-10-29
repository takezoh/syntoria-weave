/** Touch press policy for list rows. Pointer capture, timers, geometry and transforms are adapter effects. */
export const PRESS_SLOP=10,LONG_PRESS_MS=500;
export type PressMode='pending'|'swipe'|'hold'|'released';
export type SwipeSide='finish'|'ask';
export type SwipeChoice='done'|'drop'|'ask';
export type SwipeAllowance=Readonly<{finish:boolean;ask:boolean}>;

/** A press stays pending inside the slop; a mostly sideways move becomes a swipe and any other move is left to scrolling. */
export function pressMove(mode:PressMode,dx:number,dy:number,swipeable:boolean):PressMode {
 if(mode!=='pending'||Math.hypot(dx,dy)<PRESS_SLOP)return mode;
 return swipeable&&Math.abs(dx)>Math.abs(dy)*1.5?'swipe':'released';
}

/** A press still pending when the long-press delay ends holds the row for moving, if the row can move. */
export function pressTimeout(mode:PressMode,movable:boolean):PressMode {
 return mode==='pending'&&movable?'hold':mode;
}

/**
 * Rightward swipes finish an Action, Done first and Dropped further along the same direction; leftward swipes ask AI.
 * A direction that is not allowed only resists, so nothing is chosen there.
 */
export function swipeChoice(dx:number,width:number,allowed:SwipeAllowance):Readonly<{offset:number;side:SwipeSide|null;choice:SwipeChoice|null}> {
 const near=Math.max(64,width*.25),far=Math.max(near+72,width*.55);
 if(dx>0&&allowed.finish)return {offset:Math.min(dx,width),side:'finish',choice:dx>=far?'drop':dx>=near?'done':null};
 if(dx<0&&allowed.ask)return {offset:Math.max(dx,-width*.6),side:'ask',choice:-dx>=near?'ask':null};
 return {offset:Math.sign(dx)*Math.min(Math.abs(dx)*.2,16),side:null,choice:null};
}
