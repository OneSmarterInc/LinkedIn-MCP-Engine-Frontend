import { useMemo, useState } from "react";
import { ageText, type PipelineRow } from "../api";
import { Pill } from "./ui";

const FRESH_H = 48;

/** Shared table for job posts, the review queue and the pipeline. Rows open the drawer. */
export function RowsTable({ rows, selected, onOpen, showSignal, emptyText }: { rows: PipelineRow[]; selected?: string; onOpen: (r: PipelineRow) => void; showSignal: boolean; emptyText: string }) {
  if (!rows.length) return <div className="empty">{emptyText}</div>;
  return <div className="card tablewrap"><table className="rows">
    <colgroup>{showSignal ? <><col style={{ width: "19%" }} /><col style={{ width: "13%" }} /><col style={{ width: "14%" }} /></> : <><col style={{ width: "20%" }} /><col style={{ width: "16%" }} /></>}<col style={{ width: "17%" }} /><col style={{ width: "11%" }} /><col />{showSignal && <col style={{ width: "11%" }} />}</colgroup>
    <thead><tr>
      {showSignal ? <><th>Role they are hiring</th><th>Company</th></> : <><th>Contact</th><th>Company</th></>}
      {showSignal && <th>Contact</th>}
      <th>Email</th><th>Status</th><th>Subject</th>{showSignal && <th>Posted</th>}
    </tr></thead>
    <tbody>{rows.map((r) => {
      const postedRaw = r.signal?.posted ?? ""; const postedDate = postedRaw.match(/\d{4}-\d{2}-\d{2}/)?.[0]; const unconfirmed = /unconfirmed/i.test(postedRaw);
      const h = postedDate ? Math.round((Date.now() - new Date(postedDate).getTime()) / 3600e3) : undefined;
      return <tr key={`${r.tab}:${r.email}`} className={`row ${selected === r.email ? "sel" : ""}`} onClick={() => onOpen(r)}>
        {showSignal ? <>
          <td><div className="t clamp2" title={r.signal?.role}>{r.signal?.role ?? "—"}</div>{r.signal?.url && <div className="s">LinkedIn post</div>}</td>
          <td><div className="t">{r.company}</div><div className="s">{r.domain}</div></td>
          <td><div>{r.name}</div><div className="s clamp2" title={r.title}>{r.title}</div></td>
        </> : <>
          <td><div className="t">{r.name}</div><div className="s clamp2" title={r.title}>{r.title}</div></td>
          <td><div className="t">{r.company}</div><div className="s">{r.domain}</div></td>
        </>}
        <td><span className="mono email" title={r.email}>{r.email}</span></td>
        <td><Pill s={r.status} /></td>
        <td><div className="s clamp2" title={r.subject}>{r.subject}</div></td>
        {showSignal && <td>{postedDate ? <><div className={`age ${h !== undefined && h <= FRESH_H ? "fresh" : ""}`} title={unconfirmed ? "Date read from the post; not confirmed" : undefined}>{unconfirmed ? "~" : ""}{ageText(postedDate)}</div><div className="hint" style={{ whiteSpace: "nowrap" }}>{postedDate}</div></> : <span className="hint">{postedRaw || "—"}</span>}</td>}
      </tr>;
    })}</tbody>
  </table></div>;
}

export function useRowFilters(rows: PipelineRow[] | null) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [company, setCompany] = useState<string>("");
  const companies = useMemo(() => Array.from(new Set((rows ?? []).map((r) => r.company))).sort(), [rows]);
  const filtered = useMemo(() => (rows ?? []).filter((r) => {
    if (status && r.status !== status) return false;
    if (company && r.company !== company) return false;
    if (q) { const s = `${r.company} ${r.name} ${r.title} ${r.email} ${r.signal?.role ?? ""} ${r.subject}`.toLowerCase(); if (!s.includes(q.toLowerCase())) return false; }
    return true;
  }), [rows, q, status, company]);
  return { q, setQ, status, setStatus, company, setCompany, companies, filtered };
}

export const STATUSES = ["Ready for Review", "Needs Rewrite", "Approved", "Sending", "Sent", "Replied", "Meeting Booked", "Rejected", "Opted Out", "Bounced", "Send Error"];
