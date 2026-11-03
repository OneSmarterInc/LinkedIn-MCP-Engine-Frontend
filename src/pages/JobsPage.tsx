import { useState } from "react";
import { api, type LeftOutRow, type PipelineRow } from "../api";
import { Drawer } from "../components/Drawer";
import { RowsTable, STATUSES, useRowFilters } from "../components/RowsTable";
import { Err, usePoll } from "../components/ui";

/** Job posts: every LinkedIn "we're hiring" post that produced a contact, plus the ones the gates left out and why. */
export function JobsPage({ onCount }: { onCount: (n: number) => void }) {
  const rows = usePoll("pipeline:Jobs_Pipeline", () => api.pipeline("Jobs_Pipeline").then((r) => { onCount(r.rows.filter((x) => x.status === "Ready for Review").length); return r.rows; }), 30_000);
  const left = usePoll("leftout:jobs", () => api.leftOut().then((r) => r.rows.filter((x) => x.tab.startsWith("Jobs"))), 60_000);
  const f = useRowFilters(rows.data);
  const [sel, setSel] = useState<PipelineRow | null>(null);
  const [showLeft, setShowLeft] = useState(false);
  const all = rows.data ?? [];
  const n = (s: string) => all.filter((r) => r.status === s).length;
  const fresh = all.filter((r) => r.signal?.posted && Date.now() - new Date(r.signal.posted).getTime() < 48 * 3600e3).length;

  function changed(r: PipelineRow) { rows.setData((all.map((x) => (x.email === r.email ? r : x)))); setSel(r); }

  return <>
    <div className="stats">
      <div className="stat hot"><div className="k">Posted in last 48 h</div><div className="v">{fresh}</div></div>
      <div className="stat"><div className="k">Waiting for you</div><div className="v">{n("Ready for Review") + n("Needs Rewrite")}</div></div>
      <div className="stat"><div className="k">Approved, sending soon</div><div className="v">{n("Approved") + n("Sending")}</div></div>
      <div className="stat"><div className="k">Sent</div><div className="v">{n("Sent")}</div></div>
      <div className="stat"><div className="k">Replied / booked</div><div className="v">{n("Replied") + n("Meeting Booked")}</div></div>
      <div className="stat"><div className="k">Left out by the checks</div><div className="v">{left.data?.length ?? "…"}</div></div>
    </div>
    <div className="filters">
      <span className="lbl">Status</span>
      <div className="chips">{["", ...STATUSES.filter((s) => n(s) > 0)].map((s) => <button key={s || "all"} className={`chip ${f.status === s ? "on" : ""}`} onClick={() => f.setStatus(s)}>{s || `All (${all.length})`}{s ? ` ${n(s)}` : ""}</button>)}</div>
      <select value={f.company} onChange={(e) => f.setCompany(e.target.value)}><option value="">All companies</option>{f.companies.map((c) => <option key={c}>{c}</option>)}</select>
      <button className="linkish" onClick={() => setShowLeft((v) => !v)}>{showLeft ? "Hide" : "Show"} who was left out and why</button>
    </div>
    <Err msg={rows.error} />
    {rows.loading ? <div className="empty">Reading the Jobs_Pipeline tab…</div> : <RowsTable rows={f.filtered} selected={sel?.email} onOpen={setSel} showSignal emptyText={all.length ? "Nothing matches these filters." : "No job posts yet. Start a job search on the Runs page; results land in the Jobs_Pipeline tab and here."} />}
    {showLeft && <LeftOut rows={left.data ?? []} />}
    {sel && <Drawer row={sel} onClose={() => setSel(null)} onChanged={changed} />}
  </>;
}

export function LeftOut({ rows }: { rows: LeftOutRow[] }) {
  return <div className="card tablewrap">
    <div style={{ padding: "10px 14px", fontWeight: 600, fontSize: 14 }}>Left out by the checks <span className="hint">· these are in the quarantine tab, nothing was sent</span></div>
    {rows.length ? <table><thead><tr><th>Company</th><th>Contact</th><th>Email</th><th>Why</th></tr></thead><tbody>
      {rows.map((r, i) => <tr key={i}><td className="t">{r.company}</td><td>{r.name}<div className="s">{r.title}</div></td><td className="mono" style={{ fontSize: 12 }}>{r.email || "—"}</td><td><div>{r.why}</div><div className="s mono">{r.failed_gate} · {r.reason}</div></td></tr>)}
    </tbody></table> : <div className="empty">Nothing in quarantine.</div>}
  </div>;
}
