import { useEffect, useState } from "react";
import { api, ageText, type PipelineRow } from "../api";
import { Pill, useToast } from "./ui";

/** Review one row: the hiring signal, the contact, the draft (editable while it waits), and the decision. */
export function Drawer({ row, onClose, onChanged }: { row: PipelineRow; onClose: () => void; onChanged: (r: PipelineRow) => void }) {
  const toast = useToast();
  const [subject, setSubject] = useState(row.subject);
  const [body, setBody] = useState(row.body.replace(/^Hi [^,\n]+,\s*/i, ""));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSubject(row.subject); setBody(row.body.replace(/^Hi [^,\n]+,\s*/i, "")); }, [row.email, row.subject, row.body]);

  const editable = row.status === "Ready for Review" || row.status === "Needs Rewrite";
  const first = row.name.split(" ")[0] ?? "";
  const checks: Array<[string, boolean]> = row.body ? [
    ["Names the company", body.toLowerCase().includes(row.company.toLowerCase().split(/\s+/)[0] ?? "")],
    ...(row.signal ? [["Names the role", body.toLowerCase().includes((row.signal.role.toLowerCase().split(/\s+/).pop() ?? ""))] as [string, boolean]] : []),
    ["4 sentences", (body.match(/[.!?](\s|$)/g) || []).length === 4],
    ["Ends with a question", body.trim().endsWith("?")],
  ] : [];

  async function act(kind: "approve" | "reject" | "reopen" | "save") {
    setBusy(true);
    try {
      if (kind === "save" || kind === "approve") {
        if (editable && (subject !== row.subject || `Hi ${first},\n\n${body}` !== row.body)) await api.saveDraft(row.email, { subject, body: `Hi ${first},\n\n${body}` });
      }
      const r = kind === "approve" ? await api.approve(row.email) : kind === "reject" ? await api.reject(row.email) : kind === "reopen" ? await api.reopen(row.email) : { ...row, subject, body: `Hi ${first},\n\n${body}` };
      onChanged(r);
      toast(kind === "approve" ? `Approved. AutoBooker sends to ${row.email} within 15 minutes.` : kind === "reject" ? "Rejected. Nothing will be sent." : kind === "reopen" ? "Back to Ready for Review." : "Draft saved to the Sheet.");
      if (kind !== "save") onClose();
    } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  }

  return <>
    <div className="scrim" onClick={onClose} />
    <aside className="drawer" aria-label="Review">
      <div className="dhead">
        <div><h2>{row.signal ? `${row.signal.role} at ${row.company}` : `${row.name} at ${row.company}`}</h2><div className="s">{row.tab === "Jobs_Pipeline" ? "Job post" : "Lead"} · {row.domain || "no domain"}</div></div>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="dbody">
        {row.signal && <div className="signal"><b>Hiring signal</b> · {row.signal.role}{row.signal.posted ? ` · posted ${row.signal.posted}` : ""}{row.signal.url && <> · <a href={row.signal.url} target="_blank" rel="noopener">open the post</a></>}</div>}
        <dl className="kv">
          <dt>Contact</dt><dd>{row.name}{row.title ? `, ${row.title}` : ""}</dd>
          <dt>Email</dt><dd><span className="mono">{row.email}</span> <button className="btn sm" onClick={() => navigator.clipboard?.writeText(row.email).then(() => toast("Copied")).catch(() => toast("Select the address to copy it"))}>Copy</button></dd>
          <dt>Status</dt><dd><Pill s={row.status} />{row.thread_id && <span className="hint"> · thread {row.thread_id.slice(0, 10)}…</span>}</dd>
          {row.research && !row.signal && <><dt>Research</dt><dd className="s">{row.research}</dd></>}
        </dl>
        {row.body ? <div>
          <div className="hint" style={{ marginBottom: 6 }}>{editable ? "Draft (editable until approved)" : "Email as sent"}</div>
          <div className="draft">
            <div className="subj">Subject: <input value={subject} onChange={(e) => setSubject(e.target.value)} readOnly={!editable} /></div>
            <div style={{ padding: "8px 12px 0", color: "var(--fg-3)", fontSize: 13 }}>Hi {first},</div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} readOnly={!editable} />
          </div>
          <div className="checks" style={{ marginTop: 8 }}>{checks.map(([k, ok]) => <span key={k} className={`pill ${ok ? "ok" : "bad"}`}>{ok ? "✓" : "✗"} {k}</span>)}</div>
        </div> : <div className="hint">No draft on this row.</div>}
      </div>
      <div className="dfoot">
        {editable && <><button className="btn primary" disabled={busy} onClick={() => act("approve")}>Approve · sends within 15 min</button><button className="btn" disabled={busy} onClick={() => act("save")}>Save edits</button><button className="btn danger" disabled={busy} onClick={() => act("reject")}>Reject</button></>}
        {row.status === "Approved" && <><button className="btn" disabled={busy} onClick={() => act("reopen")}>Undo approval</button><span className="note">Queued. AutoBooker picks it up on its next 15-minute cycle and writes Sent and the thread id back to the Sheet.</span></>}
        {row.status === "Rejected" && <button className="btn" disabled={busy} onClick={() => act("reopen")}>Restore to Ready for Review</button>}
        {["Sent", "Replied", "Meeting Booked", "Sending"].includes(row.status) && <span className="note">{row.status === "Sent" ? "Sent. Replies are read every 10 minutes." : row.status === "Replied" ? "They replied. AutoBooker offered times or left it for you; see the Notes column in the Sheet." : row.status === "Meeting Booked" ? "Invite is on the calendar." : "Sending now."}</span>}
      </div>
    </aside>
  </>;
}
