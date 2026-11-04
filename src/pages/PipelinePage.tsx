import { useMemo, useState } from "react";
import { Drawer, useLiveItem, type DrawerItem } from "../components/Drawer";
import { Banner, Loading, Pill, StatusPill } from "../components/ui";
import { useData } from "../context/DataContext";
import { gmailThread } from "../utils/format";

/** The Pipeline and Jobs_Pipeline tabs as the engine sees them, plus the leads that were held back. */
export function PipelinePage({ query }: { query: string }) {
  const { rows, leftOut, summary, loading, error } = useData();
  const [show, setShow] = useState<"rows" | "left-out">("rows");
  const [tab, setTab] = useState<"" | "Pipeline" | "Jobs_Pipeline">("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<DrawerItem>();
  const live = useLiveItem(open);

  const q = query.trim().toLowerCase();
  const statuses = Object.keys(summary?.by_status ?? {}).sort();
  const visible = useMemo(() => rows.filter((r) =>
    (!tab || r.tab === tab) && (!status || r.status === status)
    && (!q || [r.name, r.title, r.company, r.email, r.subject].join(" ").toLowerCase().includes(q)),
  ), [rows, tab, status, q]);
  const held = useMemo(() => leftOut.filter((r) =>
    (!tab || r.tab === (tab === "Pipeline" ? "Quarantined" : "Jobs_Quarantine"))
    && (!q || [r.name, r.company, r.email, r.why, r.campaign].join(" ").toLowerCase().includes(q)),
  ), [leftOut, tab, q]);

  if (loading) return <Loading />;

  return (
    <section className="view">
      {error && <Banner tone="bad">{error}</Banner>}
      <p className="hint">The Pipeline and Jobs_Pipeline tabs as the engine sees them. Rows stay in the Sheet; this view reads them live and writes status changes back through the engine.</p>
      <div className="filters">
        <div className="chips" role="group" aria-label="Show">
          <button className={`chip${show === "rows" ? " on" : ""}`} onClick={() => setShow("rows")}>Emails ({rows.length})</button>
          <button className={`chip${show === "left-out" ? " on" : ""}`} onClick={() => setShow("left-out")}>Held back ({summary?.quarantined ?? leftOut.length})</button>
        </div>
        <span className="lbl">Tab</span>
        <select value={tab} onChange={(e) => setTab(e.target.value as typeof tab)} aria-label="Tab">
          <option value="">Both</option><option value="Pipeline">Pipeline (campaigns)</option><option value="Jobs_Pipeline">Jobs_Pipeline (job posts)</option>
        </select>
        {show === "rows" && (<>
          <span className="lbl">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All</option>
            {statuses.map((s) => <option key={s} value={s}>{s} ({summary?.by_status[s]})</option>)}
          </select>
        </>)}
      </div>

      <div className="card"><div className="tablewrap">
        {show === "rows" ? (
          <table>
            <thead><tr><th>Status</th><th>Person</th><th>Company</th><th>Subject</th><th>Campaign</th><th>Thread</th></tr></thead>
            <tbody>
              {visible.length === 0 && <tr><td colSpan={6} className="empty">No rows match.</td></tr>}
              {visible.map((r) => (
                <tr key={`${r.tab}:${r.row_number}`} className="row" onClick={() => setOpen({ kind: "row", row: r })}>
                  <td><StatusPill status={r.status} /></td>
                  <td>{r.name}{r.title ? ` · ${r.title}` : ""}</td>
                  <td>{r.company}</td>
                  <td className="s">{r.subject}</td>
                  <td className="s">{r.tab === "Jobs_Pipeline" ? "Job search" : "Lead campaign"}</td>
                  <td className="s" onClick={(e) => e.stopPropagation()}>{r.thread_id ? <a href={gmailThread(r.thread_id)} target="_blank" rel="noopener noreferrer">Open in Gmail</a> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table>
            <thead><tr><th>Why it was held back</th><th>Person</th><th>Company</th><th>Email</th><th>Campaign</th><th>Gate</th></tr></thead>
            <tbody>
              {held.length === 0 && <tr><td colSpan={6} className="empty">Nothing held back.</td></tr>}
              {held.map((r) => (
                <tr key={`${r.tab}:${r.row_number}`} className="row" onClick={() => setOpen({ kind: "left-out", row: r })}>
                  <td><Pill tone="bad">{r.reason}</Pill><div className="s">{r.why}</div></td>
                  <td>{r.name}{r.title ? ` · ${r.title}` : ""}</td>
                  <td>{r.company}</td>
                  <td className="s mono">{r.email}</td>
                  <td className="s">{r.campaign}</td>
                  <td className="mono">{r.failed_gate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div></div>
      <Drawer item={live} onClose={() => setOpen(undefined)} />
    </section>
  );
}
