import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { statusKind } from "../api";

/** Toast context: one line of feedback for every action. */
const ToastCtx = createContext<(msg: string, bad?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; bad: boolean } | null>(null);
  const show = useCallback((msg: string, bad = false) => { setT({ msg, bad }); }, []);
  useEffect(() => { if (!t) return; const h = setTimeout(() => setT(null), 3000); return () => clearTimeout(h); }, [t]);
  const v = useMemo(() => show, [show]);
  return <ToastCtx.Provider value={v}>{children}{t && <div className={`toast ${t.bad ? "bad" : ""}`} role="status">{t.msg}</div>}</ToastCtx.Provider>;
}

export const Pill = ({ s, children }: { s: string; children?: ReactNode }) => <span className={`pill ${statusKind(s)}`}>{children ?? s}</span>;

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" className={`sw ${on ? "on" : ""}`} aria-label={label} aria-pressed={on} onClick={() => onChange(!on)} />;
}

/**
 * Polls a loader on an interval while `active`. Results are kept in a module-level store keyed by `key`,
 * so switching pages and coming back shows the last data at once and refreshes in the background.
 */
const store = new Map<string, unknown>();
export function usePoll<T>(key: string, load: () => Promise<T>, ms: number, active = true) {
  const [data, setDataState] = useState<T | null>(() => (store.has(key) ? (store.get(key) as T) : null));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!store.has(key));
  const setData = useCallback((v: T | null) => { if (v === null) store.delete(key); else store.set(key, v); setDataState(v); }, [key]);
  const refresh = useCallback(async () => {
    try { const v = await load(); store.set(key, v); setDataState(v); setError(null); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setDataState(store.has(key) ? (store.get(key) as T) : null); setLoading(!store.has(key)); setError(null);
    void refresh();
    if (!active) return;
    const h = setInterval(() => { void refresh(); }, ms);
    return () => clearInterval(h);
  }, [key, refresh, ms, active]);
  return { data, error, loading, refresh, setData };
}

export const Err = ({ msg }: { msg: string | null }) => (msg ? <div className="err">{msg}</div> : null);
