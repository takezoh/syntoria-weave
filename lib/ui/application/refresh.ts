export type RefreshState = 'idle' | 'refreshing';

export interface RefreshPorts {
  readonly read: () => Promise<unknown>;
  readonly isIdle: () => boolean;
  readonly onIdle: (listener: () => void) => () => void;
  readonly schedule: (callback: () => void) => void;
  readonly stateChanged?: (state: RefreshState) => void;
}

/** Coalesces refresh intents and resumes one deferred read when writes and IME are idle. */
export function createRefreshCoordinator(ports: RefreshPorts) {
  let started = false;
  let disposed = false;
  let pending = false;
  let running: Promise<void> | null = null;

  const unsubscribe = ports.onIdle(() => {
    if (pending && started && !running && !disposed) ports.schedule(() => { void flush(); });
  });

  function flush(): Promise<void> {
    if (disposed || !started || !pending || running || !ports.isIdle()) return running ?? Promise.resolve();
    pending = false;
    ports.stateChanged?.('refreshing');
    running = Promise.resolve().then(ports.read).then(
      () => {},
      () => {},
    ).finally(() => {
      running = null;
      if (!disposed) ports.stateChanged?.('idle');
      if (pending && started && !disposed) ports.schedule(() => { void flush(); });
    });
    return running;
  }

  function request(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (running) return running;
    pending = true;
    return flush();
  }

  return {
    request,
    start() { started = true; return request(); },
    flush,
    get state(): RefreshState { return running ? 'refreshing' : 'idle'; },
    dispose() { disposed = true; pending = false; unsubscribe(); ports.stateChanged?.('idle'); },
  };
}
