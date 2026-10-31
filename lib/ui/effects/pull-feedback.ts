import {idlePullFeedback, projectPullFeedback, pullFeedbackTransition, type PullFeedbackEvent} from '../model/pull-feedback';

/** Moves only the list content; the scroll viewport and fixed chrome stay in place. */
export function installPullFeedback(document: Document, window: Window, ports: {readonly content: HTMLElement; readonly indicator: HTMLElement}) {
  let state = idlePullFeedback;
  let disposed = false;
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const icon = ports.indicator.querySelector<SVGElement>('svg');
  function draw(reset = false) {
    const view = projectPullFeedback(state, Boolean(motion?.matches));
    ports.content.style.transition = reset ? 'none' : view.transition;
    ports.content.style.transform = view.distance ? `translateY(${view.distance}px)` : '';
    ports.indicator.hidden = !view.visible;
    ports.indicator.setAttribute('aria-label', view.label);
    ports.indicator.setAttribute('aria-busy', String(view.busy));
    ports.indicator.dataset.refreshing = String(view.busy);
    if (icon) icon.style.transform = `rotate(${view.rotation}deg)`;
  }
  function send(event: PullFeedbackEvent) {
    if (disposed) return;
    state = pullFeedbackTransition(state, event);
    draw(event.type === 'reset');
  }
  const reset = () => send({type: 'reset'});
  const visibility = () => { if (document.visibilityState === 'hidden') reset(); };
  const motionChanged = () => draw();
  window.addEventListener('pagehide', reset);
  window.addEventListener('resize', reset, {passive: true});
  document.addEventListener('visibilitychange', visibility);
  motion?.addEventListener?.('change', motionChanged);
  draw(true);
  return {
    track: (distance: number) => send({type: 'track', distance}),
    clear: () => send({type: 'clear'}),
    request: () => send({type: 'request'}),
    settled: () => send({type: 'settled'}),
    reset,
    dispose() {
      reset();
      disposed = true;
      window.removeEventListener('pagehide', reset);
      window.removeEventListener('resize', reset);
      document.removeEventListener('visibilitychange', visibility);
      motion?.removeEventListener?.('change', motionChanged);
    },
  };
}
