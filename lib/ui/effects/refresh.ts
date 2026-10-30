/** Browser lifecycle and the retained header button are refresh event sources only. */
export function installRefresh(document: Document, window: Window, options: {
  readonly button: HTMLButtonElement;
  readonly request: () => Promise<unknown>;
  readonly start: () => Promise<unknown>;
}) {
  let ready = false;
  let disposed = false;
  let foreground = document.visibilityState !== 'hidden';

  const request = () => {
    if (!disposed && ready) void options.request();
  };
  const active = () => {
    if (document.visibilityState === 'hidden') return;
    if (!foreground) {
      foreground = true;
      request();
    }
  };
  const inactive = () => { foreground = false; };
  const visibility = () => document.visibilityState === 'hidden' ? inactive() : active();
  const click = () => request();

  options.button.addEventListener('click', click);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('focus', active);
  window.addEventListener('blur', inactive);
  window.addEventListener('pageshow', active);
  window.addEventListener('pagehide', inactive);

  return {
    start() { ready = true; return options.start(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      options.button.removeEventListener('click', click);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', active);
      window.removeEventListener('blur', inactive);
      window.removeEventListener('pageshow', active);
      window.removeEventListener('pagehide', inactive);
    },
  };
}
