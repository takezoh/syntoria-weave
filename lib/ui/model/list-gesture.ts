export type SwipeAllowance = Readonly<{finish: boolean; ask: boolean}>;
export type SwipeSide = 'finish' | 'ask';
export type SwipeChoice = 'done' | 'drop' | 'ask';

export const LIST_GESTURE_SLOP = 10;
export const LIST_HOLD_DELAY = 500;
export const LIST_MOVE_SLOP = 6;
export const LIST_PULL_THRESHOLD = 64;

function swipeChoice(dx: number, width: number, allowed: SwipeAllowance): Readonly<{offset: number; side: SwipeSide | null; choice: SwipeChoice | null}> {
  const near = Math.max(64, width * 0.25), far = Math.max(near + 72, width * 0.55);
  if (dx > 0 && allowed.finish) return {offset: Math.min(dx, width), side: 'finish', choice: dx >= far ? 'drop' : dx >= near ? 'done' : null};
  if (dx < 0 && allowed.ask) return {offset: Math.max(dx, -width * 0.6), side: 'ask', choice: -dx >= near ? 'ask' : null};
  return {offset: Math.sign(dx) * Math.min(Math.abs(dx) * 0.2, 16), side: null, choice: null};
}

export interface ListGestureRow {
  readonly id: string;
  readonly key: string;
  readonly kind: 'action' | 'project' | 'tag';
  readonly swipeable: boolean;
  readonly movable: boolean;
}

interface Sequence {
  readonly source: 'touch' | 'pen';
  readonly token: number;
  readonly touchId: number;
  readonly startX: number;
  readonly startY: number;
  readonly row: ListGestureRow | null;
  readonly pullEligible: boolean;
}

export type ListGestureState =
  | Readonly<{phase: 'idle'}>
  | (Sequence & Readonly<{phase: 'pending'}>)
  | (Sequence & Readonly<{phase: 'scroll'}>)
  | (Sequence & Readonly<{phase: 'pull'; distance: number}>)
  | (Sequence & Readonly<{phase: 'swipe'; dx: number; offset: number; side: SwipeSide | null; choice: SwipeChoice | null}>)
  | (Sequence & Readonly<{phase: 'held'}>)
  | (Sequence & Readonly<{phase: 'move'}>);

export type ListGestureEffect =
  | Readonly<{type: 'prevent-default'}>
  | Readonly<{type: 'cancel-hold'}>
  | Readonly<{type: 'show-pull'; distance: number}>
  | Readonly<{type: 'clear-pull'}>
  | Readonly<{type: 'request-refresh'}>
  | Readonly<{type: 'show-swipe'; row: ListGestureRow; offset: number; side: SwipeSide | null; choice: SwipeChoice | null}>
  | Readonly<{type: 'clear-swipe'; row: ListGestureRow}>
  | Readonly<{type: 'suppress-click'}>
  | Readonly<{type: 'commit-swipe'; row: ListGestureRow; choice: SwipeChoice | null}>
  | Readonly<{type: 'begin-move'; row: ListGestureRow; x: number; y: number}>
  | Readonly<{type: 'move'; x: number; y: number}>
  | Readonly<{type: 'end-move'}>
  | Readonly<{type: 'cancel-move'}>
  | Readonly<{type: 'clear-held'; row: ListGestureRow}>
  | Readonly<{type: 'open-move'; row: ListGestureRow}>;

export type ListGestureEvent =
  | Readonly<{type: 'start'; source: 'touch' | 'pen'; token: number; touchId: number; x: number; y: number; atTop: boolean; pullAllowed: boolean; eligible: boolean; row: ListGestureRow | null; touchCount: number}>
  | Readonly<{type: 'move'; token: number; touchId: number; x: number; y: number; touchCount: number; cancelable: boolean; allowed: boolean; pullAllowed: boolean; swipeAllowance: SwipeAllowance; rowWidth: number}>
  | Readonly<{type: 'hold-timeout'; token: number}>
  | Readonly<{type: 'end'; token: number; touchId: number; touchCount: number; allowed: boolean; pullAllowed: boolean; swipeAllowance: SwipeAllowance; rowWidth: number}>
  | Readonly<{type: 'cancel'; token?: number}>;

export interface ListGestureTransition {
  readonly state: ListGestureState;
  readonly effects: readonly ListGestureEffect[];
}

const idle: ListGestureState = {phase: 'idle'};
const noEffects: readonly ListGestureEffect[] = [];
const sequenceMatches = (state: Exclude<ListGestureState, {phase: 'idle'}>, event: {readonly token: number; readonly touchId?: number}) =>
  state.token === event.token && (event.touchId === undefined || state.touchId === event.touchId);

function cancelEffects(state: ListGestureState): ListGestureEffect[] {
  if (state.phase === 'idle' || state.phase === 'scroll' || state.phase === 'pending') return [{type: 'cancel-hold'}];
  if (state.phase === 'pull') return [{type: 'cancel-hold'}, {type: 'clear-pull'}, {type: 'suppress-click'}];
  if (state.phase === 'swipe' && state.row) return [{type: 'cancel-hold'}, {type: 'clear-swipe', row: state.row}];
  if (state.phase === 'held' && state.row) return [{type: 'cancel-hold'}, {type: 'clear-held', row: state.row}, {type: 'cancel-move'}];
  if (state.phase === 'move' && state.row) return [{type: 'cancel-hold'}, {type: 'clear-held', row: state.row}, {type: 'cancel-move'}];
  return [{type: 'cancel-hold'}];
}

/** One deterministic owner arbitrates native scroll, pull, swipe and hold for a touch sequence. */
export function listGestureTransition(state: ListGestureState, event: ListGestureEvent): ListGestureTransition {
  if (event.type === 'start') {
    if (event.touchCount !== 1 || !event.eligible) return {state: idle, effects: cancelEffects(state)};
    return {
      state: {
        phase: 'pending', source: event.source, token: event.token, touchId: event.touchId, startX: event.x, startY: event.y,
        row: event.row, pullEligible: event.atTop && event.pullAllowed,
      },
      effects: state.phase === 'idle' ? noEffects : cancelEffects(state),
    };
  }

  if (event.type === 'cancel') {
    if (event.token !== undefined && state.phase !== 'idle' && state.token !== event.token) return {state, effects: noEffects};
    return {state: idle, effects: cancelEffects(state)};
  }

  if (state.phase === 'idle' || !sequenceMatches(state, event)) return {state, effects: noEffects};

  if (event.type === 'hold-timeout') {
    if (state.phase !== 'pending' || !state.row?.movable) return {state, effects: noEffects};
    return {state: {...state, phase: 'held'}, effects: [{type: 'begin-move', row: state.row, x: state.startX, y: state.startY}]};
  }

  if (event.type === 'end') {
    if (event.touchCount !== 0 || event.touchId !== state.touchId || !event.allowed) return {state: idle, effects: cancelEffects(state)};
    if (state.phase === 'pull') return {state: idle, effects: [{type: 'cancel-hold'}, {type: 'clear-pull'}, {type: 'suppress-click'}, ...(event.pullAllowed && state.distance >= LIST_PULL_THRESHOLD ? [{type: 'request-refresh'} as const] : [])]};
    if (state.phase === 'swipe' && state.row) {
      const swipe = swipeChoice(state.dx, event.rowWidth, event.swipeAllowance);
      return {state: idle, effects: [{type: 'cancel-hold'}, {type: 'clear-swipe', row: state.row}, {type: 'suppress-click'}, {type: 'commit-swipe', row: state.row, choice: swipe.choice}]};
    }
    if (state.phase === 'held' && state.row) return {state: idle, effects: [{type: 'cancel-hold'}, {type: 'clear-held', row: state.row}, {type: 'suppress-click'}, {type: 'open-move', row: state.row}]};
    if (state.phase === 'move' && state.row) return {state: idle, effects: [{type: 'cancel-hold'}, {type: 'clear-held', row: state.row}, {type: 'suppress-click'}, {type: 'end-move'}]};
    return {state: idle, effects: [{type: 'cancel-hold'}]};
  }

  if (event.touchCount !== 1 || !event.allowed) return {state: idle, effects: cancelEffects(state)};
  const dx = event.x - state.startX, dy = event.y - state.startY;

  if (state.phase === 'scroll') return {state, effects: noEffects};
  if (state.phase === 'pending') {
    if (Math.hypot(dx, dy) < LIST_GESTURE_SLOP) return {state, effects: noEffects};
    if (state.pullEligible && event.pullAllowed && dy > 0 && dy > Math.abs(dx) * 1.5) {
      if (!event.cancelable) return {state: idle, effects: cancelEffects(state)};
      const distance = Math.min(96, Math.max(0, dy * 0.5));
      return {state: {...state, phase: 'pull', distance}, effects: [{type: 'cancel-hold'}, {type: 'prevent-default'}, {type: 'show-pull', distance}]};
    }
    if (state.row?.swipeable && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (!event.cancelable) return {state: idle, effects: cancelEffects(state)};
      const swipe = swipeChoice(dx, event.rowWidth, event.swipeAllowance);
      return {state: {...state, phase: 'swipe', dx, offset: swipe.offset, side: swipe.side, choice: swipe.choice}, effects: [{type: 'cancel-hold'}, {type: 'prevent-default'}, {type: 'show-swipe', row: state.row, offset: swipe.offset, side: swipe.side, choice: swipe.choice}]};
    }
    return {state: {...state, phase: 'scroll'}, effects: [{type: 'cancel-hold'}]};
  }

  if (state.phase === 'pull') {
    if (!event.pullAllowed) return {state: idle, effects: [{type: 'cancel-hold'}, {type: 'clear-pull'}, {type: 'suppress-click'}]};
    if (dy <= 0 || dy < Math.abs(dx) * 1.5) return {state: idle, effects: [{type: 'cancel-hold'}, {type: 'clear-pull'}, {type: 'suppress-click'}]};
    if (!event.cancelable) return {state: idle, effects: [{type: 'cancel-hold'}, {type: 'clear-pull'}, {type: 'suppress-click'}]};
    const distance = Math.min(96, Math.max(0, dy * 0.5));
    return {state: {...state, distance}, effects: [{type: 'prevent-default'}, {type: 'show-pull', distance}]};
  }

  if (state.phase === 'swipe' && state.row) {
    if (!event.cancelable) return {state: idle, effects: cancelEffects(state)};
    const swipe = swipeChoice(dx, event.rowWidth, event.swipeAllowance);
    return {state: {...state, dx, offset: swipe.offset, side: swipe.side, choice: swipe.choice}, effects: [{type: 'prevent-default'}, {type: 'show-swipe', row: state.row, offset: swipe.offset, side: swipe.side, choice: swipe.choice}]};
  }

  if (state.phase === 'held' && state.row) {
    if (Math.hypot(dx, dy) < LIST_MOVE_SLOP) return {state, effects: noEffects};
    if (!event.cancelable) return {state: idle, effects: cancelEffects(state)};
    return {state: {...state, phase: 'move'}, effects: [{type: 'prevent-default'}, {type: 'move', x: event.x, y: event.y}]};
  }

  if (state.phase === 'move') {
    if (!event.cancelable) return {state: idle, effects: cancelEffects(state)};
    return {state, effects: [{type: 'prevent-default'}, {type: 'move', x: event.x, y: event.y}]};
  }

  return {state, effects: noEffects};
}
