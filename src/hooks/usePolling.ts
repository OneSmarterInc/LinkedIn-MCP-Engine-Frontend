import { useEffect, useRef } from "react";

/**
 * Calls fn every `ms` while `active` is true and the browser tab is visible.
 * A call is skipped while the previous one is still waiting for the server, so a slow answer is never handled twice.
 */
export function usePolling(fn: () => void | Promise<void>, ms: number, active = true): void {
  const latest = useRef(fn);
  latest.current = fn;
  const busy = useRef(false);
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible" || busy.current) return;
      busy.current = true;
      void Promise.resolve()
        .then(() => latest.current())
        .catch(() => { /* the caller shows its own errors */ })
        .finally(() => { busy.current = false; });
    }, ms);
    return () => window.clearInterval(t);
  }, [ms, active]);
}
