import { useEffect, useRef } from "react";

/** Calls fn every `ms` while `active` is true and the browser tab is visible. */
export function usePolling(fn: () => void | Promise<void>, ms: number, active = true): void {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void latest.current();
    }, ms);
    return () => window.clearInterval(t);
  }, [ms, active]);
}
