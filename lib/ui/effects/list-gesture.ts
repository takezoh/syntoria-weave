import {
  listGestureTransition,
  LIST_HOLD_DELAY,
  type ListGestureEffect,
  type ListGestureEvent,
  type ListGestureRow,
  type ListGestureState,
  type SwipeAllowance,
} from '../model/list-gesture';

export interface ListGesturePorts {
  readonly scroller: HTMLElement;
  readonly settled?: () => void;
  readonly showPull: (distance: number) => void;
  readonly clearPull: () => void;
  readonly allowed: () => boolean;
  readonly canStart: () => boolean;
  readonly pullAllowed: () => boolean;
  readonly swipeAllowance: (id: string) => SwipeAllowance;
  readonly refresh: () => void;
  readonly beginMove: (row: ListGestureRow, element: HTMLElement, x: number, y: number, source: 'touch' | 'pen', contactId?: number) => boolean;
  readonly move: (x: number, y: number) => void;
  readonly endMove: () => void;
  readonly cancelMove: () => void;
  readonly openMove: (row: ListGestureRow, element: HTMLElement) => void;
  readonly swipe: (row: ListGestureRow, choice: 'done' | 'drop' | 'ask' | null) => void;
  readonly suppressClick: () => void;
  readonly timers?: {
    readonly schedule: (callback: () => void, milliseconds: number) => unknown;
    readonly cancel: (handle: unknown) => void;
  };
}

/** One list-scoped adapter normalizes Touch Events and pen Pointer Events into the shared arbiter. */
export function installListGesture(document: Document, window: Window, ports: ListGesturePorts) {
  const schedule = ports.timers?.schedule ?? ((callback: () => void, milliseconds: number) => window.setTimeout(callback, milliseconds));
  const cancelTimer = ports.timers?.cancel ?? (handle => window.clearTimeout(handle as number));
  let state: ListGestureState = {phase: 'idle'};
  let sequence = 0;
  let timer: unknown = null;
  let activeRow: HTMLElement | null = null;
  let activeSource: 'touch' | 'pen' | null = null;
  let activeContactId: number | null = null;
  let disposed = false;

  const clearTimer = () => {
    if (timer === null) return;
    cancelTimer(timer);
    timer = null;
  };
  const clearSwipe = (row: HTMLElement) => {
    row.classList.remove('swiping');
    row.style.removeProperty('--swipe-offset');
    delete row.dataset.swipe;
    delete row.dataset.swipeSide;
    if (activeSource === 'pen' && activeContactId !== null && row.hasPointerCapture?.(activeContactId)) try { row.releasePointerCapture(activeContactId); } catch { /* capture is advisory */ }
  };
  const clearHeld = (row: HTMLElement) => row.classList.remove('lifted');

  function apply(effect: ListGestureEffect, event?: {readonly cancelable: boolean; readonly defaultPrevented: boolean; preventDefault(): void}): boolean {
    switch (effect.type) {
      case 'prevent-default':
        if (!event?.cancelable) return false;
        event.preventDefault();
        return event.defaultPrevented;
      case 'cancel-hold': clearTimer(); return true;
      case 'show-pull':
        ports.showPull(effect.distance);
        return true;
      case 'clear-pull': ports.clearPull(); return true;
      case 'show-swipe': {
        const row = activeRow;
        if (!row) return true;
        if (activeSource === 'pen' && activeContactId !== null) try { row.setPointerCapture(activeContactId); } catch { /* capture is advisory */ }
        row.classList.add('swiping');
        row.style.setProperty('--swipe-offset', effect.offset + 'px');
        if (effect.side) row.dataset.swipeSide = effect.side;
        else delete row.dataset.swipeSide;
        if (effect.choice) row.dataset.swipe = effect.choice;
        else delete row.dataset.swipe;
        return true;
      }
      case 'clear-swipe': if (activeRow) clearSwipe(activeRow); return true;
      case 'suppress-click': ports.suppressClick(); return true;
      case 'commit-swipe': ports.swipe(effect.row, effect.choice); return true;
      case 'request-refresh': ports.refresh(); return true;
      case 'begin-move': {
        const row = activeRow;
        if (!row || !ports.beginMove(effect.row, row, effect.x, effect.y, activeSource ?? 'touch', activeContactId ?? undefined)) return false;
        row.classList.add('lifted');
        try { window.navigator.vibrate?.(10); } catch { /* vibration is optional */ }
        return true;
      }
      case 'move': ports.move(effect.x, effect.y); return true;
      case 'end-move': ports.endMove(); return true;
      case 'cancel-move': ports.cancelMove(); return true;
      case 'clear-held': if (activeRow) { clearHeld(activeRow); if (activeSource === 'pen' && activeContactId !== null && activeRow.hasPointerCapture?.(activeContactId)) try { activeRow.releasePointerCapture(activeContactId); } catch { /* capture is advisory */ } } return true;
      case 'open-move': {
        const row = activeRow;
        if (row) ports.openMove(effect.row, row);
        return true;
      }
    }
  }

  function transition(event: ListGestureEvent, live?: {readonly cancelable: boolean; readonly defaultPrevented: boolean; preventDefault(): void}): void {
    const result = listGestureTransition(state, event);
    state = result.state;
    for (const effect of result.effects) {
      if (!apply(effect, live)) {
        const prior = state;
        state = {phase: 'idle'};
        for (const cleanup of listGestureTransition(prior, {type: 'cancel', token: prior.phase === 'idle' ? undefined : prior.token}).effects) apply(cleanup);
        activeRow = null;
        return;
      }
    }
    if (state.phase === 'idle') { activeRow = null; activeSource = null; activeContactId = null; ports.settled?.(); }
  }

  function rowFor(target: Element): {row: ListGestureRow | null; element: HTMLElement | null} {
    const primary = target.closest<HTMLElement>('.action-select, .catalog-select');
    if (!primary || !ports.scroller.contains(primary)) return {row: null, element: null};
    const action = primary.closest<HTMLElement>('.action-row');
    if (action?.dataset.actionId && action.dataset.occurrenceKey) {
      return {row: {id: action.dataset.actionId, key: action.dataset.occurrenceKey, kind: 'action', swipeable: true, movable: true}, element: action};
    }
    const catalog = primary.closest<HTMLElement>('.catalog-row');
    const kind = catalog?.dataset.catalogKind;
    const id = catalog?.dataset.catalogId;
    const key = catalog?.dataset.outlineKey;
    if (catalog && id && key && (kind === 'project' || kind === 'tag')) {
      return {row: {id, key, kind, swipeable: false, movable: true}, element: catalog};
    }
    return {row: null, element: null};
  }

  function excluded(target: Element): boolean {
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"], dialog, [role="dialog"], .popover, button:not(.action-select):not(.catalog-select), .tree-toggle'));
  }

  function beginSequence(source: 'touch' | 'pen', touchId: number, x: number, y: number, target: Element | null, touchCount: number): void {
    if (disposed) return;
    clearTimer();
    if (touchCount !== 1) {
      transition({type: 'cancel'});
      return;
    }
    cancel();
    if (!target || target.nodeType !== 1 || !ports.scroller.contains(target)) {
      transition({type: 'cancel'});
      return;
    }
    const row = excluded(target) ? {row: null, element: null} : rowFor(target);
    const eligible = !excluded(target) && ports.allowed();
    activeRow = row.element;
    activeSource = source;
    activeContactId = touchId;
    sequence++;
    transition({
      type: 'start', source, token: sequence, touchId, x, y,
      atTop: ports.scroller.scrollTop <= 0, pullAllowed: ports.pullAllowed(), eligible: eligible && ports.canStart(), row: row.row, touchCount: 1,
    });
    if (state.phase === 'pending' && state.row?.movable) {
      const token = sequence;
      timer = schedule(() => {
        timer = null;
        if (!disposed && state.phase === 'pending' && state.token === token) transition({type: 'hold-timeout', token});
      }, LIST_HOLD_DELAY);
    }
  }

  function start(event: TouchEvent): void {
    if (state.phase !== 'idle' && state.source !== 'touch') return;
    if (event.touches.length !== 1) { cancel(); return; }
    const touch = event.touches[0];
    beginSequence('touch', touch.identifier, touch.clientX, touch.clientY, event.target as Element | null, event.touches.length);
  }

  function moveContact(source: 'touch' | 'pen', touchId: number, x: number, y: number, touchCount: number, event: {readonly cancelable: boolean; readonly defaultPrevented: boolean; preventDefault(): void}): void {
    if (disposed || state.phase === 'idle') return;
    if (state.source !== source || state.touchId !== touchId) return;
    if (touchCount !== 1) {
      transition({type: 'cancel', token: state.token});
      return;
    }
    const allowed = ports.allowed();
    if (state.phase === 'scroll') {
      if (!allowed) transition({type: 'cancel', token: state.token});
      return;
    }
    const dx = x - state.startX, dy = y - state.startY;
    const resolvingSwipe = state.phase === 'swipe' || state.phase === 'pending'
      && Boolean(state.row?.swipeable) && Math.hypot(dx, dy) >= 10 && Math.abs(dx) > Math.abs(dy) * 1.5;
    transition({
      type: 'move', token: state.token, touchId, x, y,
      touchCount, cancelable: event.cancelable, allowed, pullAllowed: ports.pullAllowed(),
      swipeAllowance: resolvingSwipe && state.row ? ports.swipeAllowance(state.row.id) : {finish: false, ask: false},
      rowWidth: resolvingSwipe ? activeRow?.getBoundingClientRect().width || window.innerWidth : 0,
    }, event);
  }

  function move(event: TouchEvent): void {
    const current = state;
    if (current.phase === 'idle' || current.source !== 'touch') return;
    const touchId = current.touchId, token = current.token;
    const touch = Array.from(event.touches).find(item => item.identifier === touchId);
    if (!touch) { transition({type: 'cancel', token}); return; }
    moveContact('touch', touch.identifier, touch.clientX, touch.clientY, event.touches.length, event);
  }

  function endContact(source: 'touch' | 'pen', touchId: number, touchCount: number): void {
    if (disposed || state.phase === 'idle' || state.source !== source || state.touchId !== touchId) return;
    const token = state.token;
    const resolvingSwipe = state.phase === 'swipe';
    transition({type: 'end', token, touchId, touchCount, allowed: ports.allowed(), pullAllowed: ports.pullAllowed(), swipeAllowance: resolvingSwipe && state.row ? ports.swipeAllowance(state.row.id) : {finish: false, ask: false}, rowWidth: resolvingSwipe ? activeRow?.getBoundingClientRect().width || window.innerWidth : 0});
  }

  function end(event: TouchEvent): void {
    const current = state;
    if (disposed || current.phase === 'idle' || current.source !== 'touch') return;
    const changed = Array.from(event.changedTouches).find(item => item.identifier === current.touchId);
    if (!changed) return;
    endContact('touch', changed.identifier, event.touches.length);
  }

  function cancel(): void { if (state.phase !== 'idle') transition({type: 'cancel', token: state.token}); else clearTimer(); }
  function pointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'pen' || event.button !== 0 || event.isPrimary === false) return;
    if (state.phase !== 'idle' && state.source !== 'pen') return;
    beginSequence('pen', event.pointerId, event.clientX, event.clientY, event.target as Element | null, 1);
  }
  function pointerMove(event: PointerEvent): void {
    if (event.pointerType !== 'pen' || state.phase === 'idle' || state.source !== 'pen') return;
    moveContact('pen', event.pointerId, event.clientX, event.clientY, 1, event);
  }
  function pointerUp(event: PointerEvent): void {
    if (event.pointerType === 'pen') endContact('pen', event.pointerId, 0);
  }
  function pointerCancel(event: PointerEvent): void {
    if (event.pointerType === 'pen' && state.phase !== 'idle' && state.source === 'pen' && event.pointerId === state.touchId) cancel();
  }
  function touchCancel(): void { if (state.phase !== 'idle' && state.source === 'touch') cancel(); }
  const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
  const visibility = () => { if (document.visibilityState === 'hidden') cancel(); };
  const onPageHide = () => cancel();
  const onResize = () => cancel();

  ports.scroller.addEventListener('touchstart', start, {passive: false});
  ports.scroller.addEventListener('touchmove', move, {passive: false});
  ports.scroller.addEventListener('touchend', end);
  ports.scroller.addEventListener('touchcancel', touchCancel);
  ports.scroller.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointermove', pointerMove, {passive: false});
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('pointercancel', pointerCancel);
  window.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('resize', onResize, {passive: true});

  return {
    cancel,
    get active() { return state.phase !== 'idle' && state.phase !== 'scroll'; },
    get stableRows() { return state.phase === 'swipe' || state.phase === 'held' || state.phase === 'move'; },
    dispose() {
      if (disposed) return;
      cancel();
      disposed = true;
      ports.scroller.removeEventListener('touchstart', start);
      ports.scroller.removeEventListener('touchmove', move);
      ports.scroller.removeEventListener('touchend', end);
      ports.scroller.removeEventListener('touchcancel', touchCancel);
      ports.scroller.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', pointerCancel);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('resize', onResize);
      ports.clearPull();
    },
  };
}
