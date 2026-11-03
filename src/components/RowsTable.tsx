import { useMemo, useState } from "react";
import { ageText, type PipelineRow } from "../api";
import { Pill } from "./ui";

const FRESH_H = 48;

/** Shared table for job posts, the review queue and the pipeline. Rows open the drawer. */
export function RowsTable({ rows, selected, onOpen, showSignal, emptyText }: { rows: PipelineRow[]; selected?: string; onOpen: (r: PipelineRow) => void; showSignal: boolean; emptyText: string }) {
  if (!rows.length) return <div className="empty">{emptyText}</div>;
  return <div className="card tablewrap"><table>
    <thead><tr>
      {showSignal ? <><th>Role they are hiring</th><th>Company</th></> : <><th>Contact</th><th>Company</th></>}
      {showSignal && <th>Contact</th>}
      <th>Email</th><th>Status</th><th>Subject</th>{showSignal && <th>Posted</th>}
    </tr></thead>
    <tbody>{rows.map((r) => {
      const h = r.signal?.posted ? Math.round((Date.now() - new Date(r.signal.posted).getTime()) / 3600e3) : undefined;
      return <tr key={`${r.tab}:${r.email}`} className={`row ${selected === r.email ? "sel" : ""}`} onClick={() => onOpen(r)}>
        {showSignal ? <>
          <td><div className="t">{r.signal?.role ?? "—"}</div>{r.signal?.url && <div className="s">LinkedIn post</div>}</td>
          <td><div className="t">{r.company}</div><div className="s">{r.domain}</div></td>
          <td><div>{r.name}</div><div className="s">{r.title}</div></td>
        </> : <>
          <td><div className="t">{r.name}</div><div className="s">{r.title}</div></td>
          <td><div className="t">{r.company}</div><div className="s">{r.domain}</div></td>
        </>}
        <td className="mono" style={{ fontSize: 12 }}>{r.email}</td>
        <td><Pill s={r.status} /></td>
        <td className="s" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subject}</td>
        {showSignal && <td className={`age ${h !== undefined && h <= FRESH_H ? "fresh" : ""}`}>{r.signal?.posted ? ageText(r.signal.posted) || r.signal.posted : "—"}</td>}
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
