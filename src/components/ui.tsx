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

/** Polls a loader on an interval while `active`. */
export function usePoll<T>(load: () => Promise<T>, ms: number, active = true, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { setData(await load()); setError(null); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void refresh(); if (!active) return; const h = setInterval(() => { void refresh(); }, ms); return () => clearInterval(h); }, [refresh, ms, active]);
  return { data, error, loading, refresh, setData };
}

export const Err = ({ msg }: { msg: string | null }) => (msg ? <div className="err">{msg}</div> : null);
