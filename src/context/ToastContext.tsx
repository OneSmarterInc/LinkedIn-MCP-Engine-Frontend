import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

/** The small message at the bottom of the screen after an action ("Approved…", errors in red). */
type Toast = { text: string; bad: boolean } | undefined;
const Ctx = createContext<(text: string, bad?: boolean) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast>();
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((text: string, bad = false) => {
    setToast({ text, bad });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(undefined), bad ? 6000 : 2600);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className={`toast${toast ? " show" : ""}${toast?.bad ? " bad" : ""}`} role="status" aria-live="polite">{toast?.text}</div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
