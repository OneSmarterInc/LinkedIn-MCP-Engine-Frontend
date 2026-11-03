import { useState } from "react";
import { api, type PipelineRow } from "../api";
import { Drawer } from "../components/Drawer";
import { RowsTable, STATUSES, useRowFilters } from "../components/RowsTable";
import { Err, usePoll } from "../components/ui";
import { LeftOut } from "./JobsPage";

/** Pipeline: every row from both tabs, every status. The whole Sheet, filterable. */
export function PipelinePage() {
  const [tab, setTab] = useState<"all" | "Jobs_Pipeline" | "Pipeline">("all");
  const rows = usePoll(() => api.pipeline(tab).then((r) => r.rows), 30_000, true, [tab]);
  const left = usePoll(() => api.leftOut().then((r) => r.rows), 60_000);
  const sum = usePoll(() => api.summary(), 60_000);
  const f = useRowFilters(rows.data);
  const [sel, setSel] = useState<PipelineRow | null>(null);
  const [showLeft, setShowLeft] = useState(false);
  const all = rows.data ?? [];
  const by = sum.data?.by_status ?? {};
  const n = (s: string) => all.filter((r) => r.status === s).length;

  return <>
    <div className="stats">
      {["Ready for Review", "Approved", "Sent", "Replied", "Meeting Booked", "Rejected"].map((s) => <div key={s} className={`stat ${s === "Meeting Booked" ? "hot" : ""}`}><div className="k">{s}</div><div className="v">{by[s] ?? n(s)}</div></div>)}
      <div className="stat"><div className="k">Quarantined</div><div className="v">{sum.data?.quarantined ?? "…"}</div></div>
    </div>
    <div className="filters">
      <span className="lbl">Tab</span>
      <div className="chips">{(["all", "Jobs_Pipeline", "Pipeline"] as const).map((t) => <button key={t} className={`chip ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t === "all" ? "Both" : t === "Jobs_Pipeline" ? "Job posts" : "Campaign leads"}</button>)}</div>
      <span className="lbl">Status</span>
      <select value={f.status} onChange={(e) => f.setStatus(e.target.value)}><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
      <select value={f.company} onChange={(e) => f.setCompany(e.target.value)}><option value="">All companies</option>{f.companies.map((c) => <option key={c}>{c}</option>)}</select>
      <div className="search"><input placeholder="Search name, company, email, subject" value={f.q} onChange={(e) => f.setQ(e.target.value)} /></div>
      <button className="linkish" onClick={() => setShowLeft((v) => !v)}>{showLeft ? "Hide" : "Show"} quarantine ({left.data?.length ?? "…"})</button>
    </div>
    <Err msg={rows.error} />
    {rows.loading ? <div className="empty">Reading the Sheet…</div> : <RowsTable rows={f.filtered} selected={sel?.email} onOpen={setSel} showSignal={tab === "Jobs_Pipeline"} emptyText="No rows." />}
    {showLeft && <LeftOut rows={left.data ?? []} />}
    {sel && <Drawer row={sel} onClose={() => setSel(null)} onChanged={(r) => { rows.setData(all.map((x) => (x.email === r.email ? r : x))); setSel(r); }} />}
  </>;
}
