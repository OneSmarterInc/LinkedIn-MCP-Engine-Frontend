import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode, useRef } from "react";
import { ApiError } from "../api/client";
import { api } from "../api/endpoints";
import type { LeftOutRow, PipelineRow, SearchRecord, Summary } from "../api/types";
import { usePolling } from "../hooks/usePolling";
import { useToast } from "./ToastContext";

/**
 * Sheet data every page shares, loaded once and refreshed every minute and after every change:
 * pipeline rows (Jobs_Pipeline + Pipeline), held-back rows, status counts, the AutoBooker settings
 * shown in the rail, and the latest job search (for "Seamless credits today").
 */

type Action = "approve" | "reject" | "reopen";

interface Data {
  rows: PipelineRow[];
  leftOut: LeftOutRow[];
  summary?: Summary;
  settings?: Record<string, string>;
  latestSearch?: SearchRecord;
  loading: boolean;
  error?: string;
  syncedAt?: number;
  refresh: (fresh?: boolean) => Promise<void>;
  /** Approve, reject or reopen one row. Returns the updated row, or undefined when the backend refused. */
  act: (row: PipelineRow, action: Action) => Promise<PipelineRow | undefined>;
  saveDraft: (row: PipelineRow, subject: string, body: string) => Promise<PipelineRow | undefined>;
}

const Ctx = createContext<Data | null>(null);

export function useData(): Data {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData must be used inside DataProvider");
  return v;
}

const DONE: Record<Action, (email: string) => string> = {
  approve: (email) => `Approved. Status written to the Sheet; AutoBooker sends to ${email} within 15 minutes.`,
  reject: () => "Rejected. Nothing will be sent.",
  reopen: () => "Back to Ready for Review. Nothing will be sent until it is approved again.",
};

export function DataProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [leftOut, setLeftOut] = useState<LeftOutRow[]>([]);
  const [summary, setSummary] = useState<Summary>();
  const [settings, setSettings] = useState<Record<string, string>>();
  const [latestSearch, setLatestSearch] = useState<SearchRecord>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [syncedAt, setSyncedAt] = useState<number>();

  // Each refresh and each local change gets a number. A refresh that started before a newer refresh or a local
  // change (approve, reject, edit) drops its answer, so a slow 60 s poll cannot undo a row just changed.
  const seq = useRef(0);

  const refresh = useCallback(async (fresh = false) => {
    const mine = ++seq.current;
    // All three requests start at once, but the page does not wait for all three: the drafts show as soon as
    // the rows arrive; held-back rows and the counts fill in a moment later.
    const rowsReq = api.pipeline("all", fresh);
    const restReq = Promise.all([api.leftOut(), api.summary()]);
    restReq.catch(() => {}); // awaited below; this only stops an "unhandled rejection" if the rows request fails first
    try {
      const p = await rowsReq;
      if (mine !== seq.current) return;
      setRows(p.rows);
      setSyncedAt(Date.now());
      setError(undefined);
      setLoading(false);
      const [l, s] = await restReq;
      if (mine !== seq.current) return;
      setLeftOut(l.rows);
      setSummary(s);
    } catch (e) {
      if (mine === seq.current) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // Rail extras: a failure here should not hide the rows.
    api.settings().then((s) => setSettings(s.values)).catch(() => {});
    api.latestSearch().then(setLatestSearch).catch(() => {});
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  usePolling(() => refresh(), 60_000);

  const replace = (updated: PipelineRow) => {
    seq.current++;
    setRows((rs) => rs.map((r) => (r.tab === updated.tab && r.email === updated.email ? updated : r)));
  };

  const act = useCallback(async (row: PipelineRow, action: Action) => {
    try {
      const updated = await api[action](row.email);
      replace(updated);
      toast(DONE[action](row.email));
      void refresh();
      return updated;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : String(e), true);
      return undefined;
    }
  }, [refresh, toast]);

  const saveDraft = useCallback(async (row: PipelineRow, subject: string, body: string) => {
    try {
      const updated = await api.saveDraft(row.email, { subject, body });
      replace(updated);
      toast("Draft saved to the Sheet");
      return updated;
    } catch (e) {
      toast((e as Error).message, true);
      return undefined;
    }
  }, [toast]);

  const value = useMemo<Data>(() => ({
    rows, leftOut, summary, settings, latestSearch, loading, error, syncedAt, refresh, act, saveDraft,
  }), [rows, leftOut, summary, settings, latestSearch, loading, error, syncedAt, refresh, act, saveDraft]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
