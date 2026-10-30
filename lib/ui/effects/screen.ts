import type {ScreenProjection} from '../model/screen';

export interface ScreenEffectElements {
  readonly root: HTMLElement;
  readonly listScroller: HTMLElement;
  readonly detailScrollers: readonly HTMLElement[];
}

/** Applies page visibility and preserves the list viewport across mobile detail visits. */
export function installScreen(document: Document, window: Window, elements: ScreenEffectElements) {
  let previous: ScreenProjection | null = null;
  let listScrollTop = 0;
  let focusOccurrence: string | null = null;
  let restoreGeneration = 0;

  function focusRow(key: string | null): void {
    const row = key
      ? [...elements.listScroller.querySelectorAll<HTMLElement>('[data-occurrence-key], [data-outline-key]')]
        .find(candidate => candidate.dataset.occurrenceKey === key || candidate.dataset.outlineKey === key)
      : null;
    const target = row?.querySelector<HTMLElement>('.action-select, .catalog-select');
    (target ?? elements.listScroller).focus({preventScroll: true});
  }

  function apply(projection: ScreenProjection, activeOccurrence: string | null = null): void {
    const current = previous;
    const changed = current?.mode !== projection.mode || current.page !== projection.page;
    if (current?.mode === 'mobile' && current.page === 'list' && projection.mode === 'mobile' && projection.page !== 'list') {
      listScrollTop = elements.listScroller.scrollTop;
      const focusedRow = document.activeElement?.closest<HTMLElement>('[data-occurrence-key], [data-outline-key]');
      focusOccurrence = focusedRow?.dataset.occurrenceKey ?? focusedRow?.dataset.outlineKey ?? activeOccurrence;
    }

    if (projection.mode === 'mobile') {
      elements.root.dataset.mobileScreen = projection.page;
    } else {
      delete elements.root.dataset.mobileScreen;
    }

    if (projection.mode === 'mobile' && projection.page !== 'list' && changed) {
      for (const scroller of elements.detailScrollers) scroller.scrollTop = 0;
    }

    const restoreList = changed && current?.mode === 'mobile' && current.page !== 'list'
      && projection.mode === 'mobile' && projection.page === 'list';
    previous = projection;
    if (!restoreList) return;

    const generation = ++restoreGeneration;
    const restore = () => {
      if (generation !== restoreGeneration || previous?.mode !== 'mobile' || previous.page !== 'list') return;
      elements.listScroller.scrollTop = Math.min(listScrollTop, Math.max(0, elements.listScroller.scrollHeight - elements.listScroller.clientHeight));
      focusRow(focusOccurrence);
    };
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(restore);
    else window.setTimeout(restore, 0);
  }

  return {
    apply,
    dispose() { restoreGeneration++; previous = null; },
  };
}
