import {LIST_PULL_THRESHOLD} from './list-gesture';

export type PullFeedbackState = Readonly<{phase: 'idle' | 'tracking' | 'refreshing'; distance: number}>;
export type PullFeedbackEvent = Readonly<{type: 'track'; distance: number}> | Readonly<{type: 'clear' | 'request' | 'settled' | 'reset'}>;
export const idlePullFeedback: PullFeedbackState = {phase: 'idle', distance: 0};
export const PULL_REFRESH_DISTANCE = 48;

/** Refresh state can settle a pull, but cannot start presentation for a background read. */
export function pullFeedbackTransition(state: PullFeedbackState, event: PullFeedbackEvent): PullFeedbackState {
  if (event.type === 'reset') return idlePullFeedback;
  if (event.type === 'request') return {phase: 'refreshing', distance: PULL_REFRESH_DISTANCE};
  if (event.type === 'settled') return state.phase === 'refreshing' ? idlePullFeedback : state;
  if (state.phase === 'refreshing') return state;
  if (event.type === 'clear') return idlePullFeedback;
  return event.type === 'track' ? {phase: 'tracking', distance: Math.max(0, event.distance)} : state;
}

export function projectPullFeedback(state: PullFeedbackState, reducedMotion: boolean) {
  return {
    distance: state.distance,
    visible: state.distance > 0,
    busy: state.phase === 'refreshing',
    transition: state.phase === 'tracking' || reducedMotion ? 'none' : 'transform 180ms ease-out',
    rotation: Math.min(1, state.distance / LIST_PULL_THRESHOLD) * 180,
    label: state.phase === 'refreshing' ? 'Refreshing' : state.distance >= LIST_PULL_THRESHOLD ? 'Release to refresh' : 'Pull down to refresh',
  };
}
