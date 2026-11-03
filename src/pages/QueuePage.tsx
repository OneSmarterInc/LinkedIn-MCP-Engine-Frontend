import { useEffect, useState } from "react";
import { api, type PipelineRow } from "../api";
import { Drawer } from "../components/Drawer";
import { RowsTable } from "../components/RowsTable";
import { Err, usePoll, useToast } from "../components/ui";

/** Review queue: only what waits for a decision, across both tabs. Keys: A approve, R reject, E/Enter open, arrows move. */
export function QueuePage({ onCount }: { onCount: (n: number) => void }) {
  const toast = useToast();
  const list = usePoll(() => api.pipeline("all").then((r) => { const q = r.rows.filter((x) => x.status === "Ready for Review" || x.status === "Needs Rewrite"); onCount(q.length); return q; }), 30_000);
  const rows = list.data ?? [];
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const cur = rows[i];

  function changed(r: PipelineRow) {
    const next = rows.filter((x) => x.email !== r.email || x.status === "Ready for Review" || x.status === "Needs Rewrite").map((x) => (x.email === r.email ? r : x));
    list.setData(next); onCount(next.length); setI((v) => Math.min(v, Math.max(0, next.length - 1)));
  }
  async function quick(kind: "approve" | "reject") {
    if (!cur) return;
    try { const r = kind === "approve" ? await api.approve(cur.email) : await api.reject(cur.email); changed(r); toast(kind === "approve" ? `Approved ${cur.name}. Sends within 15 min.` : `Rejected ${cur.name}.`); }
    catch (e) { toast((e as Error).message, true); }
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (open || (e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowDown" || e.key === "j") setI((v) => Math.min(v + 1, rows.length - 1));
      else if (e.key === "ArrowUp" || e.key === "k") setI((v) => Math.max(v - 1, 0));
      else if (e.key === "a" || e.key === "A") void quick("approve");
      else if (e.key === "r" || e.key === "R") void quick("reject");
      else if (e.key === "e" || e.key === "E" || e.key === "Enter" || e.key === "ArrowRight") setOpen(true);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });

  return <>
    <div className="guard"><b>{rows.length} waiting.</b> Open one to read the draft, fix it if needed, then Approve. Approved rows are picked up by AutoBooker within 15 minutes. Keys: <span className="mono">↑↓</span> move, <span className="mono">E</span> open, <span className="mono">A</span> approve, <span className="mono">R</span> reject.</div>
    <Err msg={list.error} />
    {list.loading ? <div className="empty">Reading the Sheet…</div> : <RowsTable rows={rows} selected={cur?.email} onOpen={(r) => { setI(rows.indexOf(r)); setOpen(true); }} showSignal={rows.some((r) => r.signal)} emptyText="Queue is empty. Every draft has a decision." />}
    {open && cur && <Drawer row={cur} onClose={() => setOpen(false)} onChanged={changed} />}
  </>;
}
