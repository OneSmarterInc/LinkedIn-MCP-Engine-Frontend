import { useEffect, useState, type ReactNode } from "react";
import type { LeftOutRow, PipelineRow } from "../api/types";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import { draftChecks } from "../utils/draftChecks";
import { ageText, gmailThread, withGreeting, withoutGreeting } from "../utils/format";
import { boardFromUrl, isReviewable, sourceKind } from "../utils/jobs";
import { Pill, StatusPill } from "./ui";

/** What the drawer shows: a pipeline row, or a row that was held back. */
export type DrawerItem = { kind: "row"; row: PipelineRow } | { kind: "left-out"; row: LeftOutRow };

/** Keeps the open row in step with the latest data, so a status change shows at once. */
export function useLiveItem(item?: DrawerItem): DrawerItem | undefined {
  const { rows } = useData();
  if (item?.kind !== "row") return item;
  const fresh = rows.find((r) => r.tab === item.row.tab && r.email === item.row.email);
  return fresh ? { kind: "row", row: fresh } : item;
}

/** The right-hand review panel from the design: signal, contact, editable draft, checks, actions. */
export function Drawer({ item, onClose }: { item?: DrawerItem; onClose: () => void }) {
  const open = Boolean(item);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`scrim${open ? " open" : ""}`} onClick={onClose} />
      <aside className={`drawer${open ? " open" : ""}`} aria-label="Review" aria-hidden={!open}>
        {item?.kind === "row" && <RowReview key={`${item.row.tab}:${item.row.email}:${item.row.status}`} row={item.row} onClose={onClose} />}
        {item?.kind === "left-out" && <LeftOutView row={item.row} onClose={onClose} />}
      </aside>
    </>
  );
}

function Header({ title, sub, onClose }: { title: string; sub: string; onClose: () => void }) {
  return (
    <div className="dhead">
      <div><h2>{title}</h2><div className="s">{sub}</div></div>
      <button className="x" onClick={onClose} aria-label="Close">×</button>
    </div>
  );
}

function RowReview({ row, onClose }: { row: PipelineRow; onClose: () => void }) {
  const { act, saveDraft } = useData();
  const toast = useToast();
  const editable = isReviewable(row.status);
  const [subject, setSubject] = useState(row.subject);
  const [body, setBody] = useState(withoutGreeting(row.body));
  const [busy, setBusy] = useState(false);
  const fullBody = withGreeting(row.name, body);
  const dirty = subject !== row.subject || fullBody.trim() !== row.body.trim();
  const checks = draftChecks(row, subject, body);
  const isJob = row.tab === "Jobs_Pipeline";

  const title = row.signal ? `${row.signal.role} at ${row.company}` : `${row.name || row.email} at ${row.company}`;
  const sub = [
    isJob ? (sourceKind(row) === "post" ? "LinkedIn post" : `Job listing${boardFromUrl(row.signal?.url) ? ` on ${boardFromUrl(row.signal?.url)}` : ""}`) : "Lead campaign",
    row.signal ? ageText(row.signal.posted) : "",
    row.tab,
  ].filter(Boolean).join(" · ");

  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const save = async () => Boolean(await saveDraft(row, subject, fullBody));
  const approve = () => run(async () => {
    if (dirty && !(await save())) return;
    if (await act(row, "approve")) onClose();
  });
  const copy = async () => {
    try { await navigator.clipboard.writeText(row.email); toast("Email copied"); } catch { toast("Select the address to copy it"); }
  };

  const foot: ReactNode[] = [];
  if (editable) {
    foot.push(
      <button key="a" className="btn primary" disabled={busy} onClick={approve}>Approve · sends within 15 min</button>,
      <button key="s" className="btn" disabled={busy || !dirty} onClick={() => run(save)}>Save edits</button>,
      <button key="r" className="btn danger" disabled={busy} onClick={() => run(async () => { if (await act(row, "reject")) onClose(); })}>Reject</button>,
    );
  } else if (row.status === "Send Error") {
    foot.push(
      <button key="t" className="btn primary" disabled={busy} onClick={() => run(() => act(row, "reopen"))}>Retry send</button>,
      <button key="r" className="btn danger" disabled={busy} onClick={() => run(async () => { if (await act(row, "reject")) onClose(); })}>Reject</button>,
      <span key="n" className="note">Gmail could not send this one; AutoBooker has stopped trying. Retry puts it back to Ready for Review with the error cleared; approve it again and AutoBooker sends on its next cycle.</span>,
    );
  } else if (row.status === "Approved") {
    foot.push(
      <button key="u" className="btn" disabled={busy || Boolean(row.thread_id)} onClick={() => run(() => act(row, "reopen"))}>Undo approval</button>,
      <span key="n" className="note">Queued. AutoBooker picks it up on the next 15-minute cycle and writes Sent and the thread id back to the Sheet.</span>,
    );
  } else if (row.status === "Rejected") {
    foot.push(<button key="o" className="btn" disabled={busy} onClick={() => run(() => act(row, "reopen"))}>Restore to Ready for Review</button>);
  } else if (row.thread_id) {
    foot.push(<a key="g" className="btn" href={gmailThread(row.thread_id)} target="_blank" rel="noopener noreferrer">Answer by hand in Gmail</a>);
    foot.push(<span key="n" className="note">{row.status === "Sent" ? "Sent. Replies are read every 10 minutes." : row.status === "Replied" ? "They replied. AutoBooker offered times or left it for you; see the Notes column in the Sheet." : row.status === "Meeting Booked" ? "The invite is on the calendar." : ""}</span>);
  }
  if (row.signal?.url) foot.push(<a key="l" className="btn" href={row.signal.url} target="_blank" rel="noopener noreferrer">Open on LinkedIn</a>);

  return (
    <>
      <Header title={title} sub={sub} onClose={onClose} />
      <div className="dbody">
        {row.signal && (
          <div className="signal">
            <b>Hiring signal</b> · {sourceKind(row) === "post" ? `${row.name || "Someone"} posted` : "Listing posted"} {ageText(row.signal.posted)}: “{row.signal.role}”
            {row.signal.url && <> · <a className="mono" href={row.signal.url} target="_blank" rel="noopener noreferrer">{row.signal.url.replace(/^https?:\/\/(www\.)?/, "")}</a></>}
          </div>
        )}
        <dl className="kv">
          <dt>Contact</dt><dd>{row.name ? `${row.name}${row.title ? `, ${row.title}` : ""}` : "Not identified yet"}</dd>
          <dt>Email</dt><dd><span className="email">{row.email} <button className="btn sm" onClick={copy}>Copy</button></span></dd>
          <dt>Gates</dt><dd><Pill tone="ok">5 of 5 passed</Pill> <span className="hint">domain, not a role account, entity, mailbox</span></dd>
          <dt>Status</dt><dd><StatusPill status={row.status} />{row.thread_id && <span className="hint"> · thread {row.thread_id.slice(0, 10)}…</span>}</dd>
          {row.notes && <><dt>AutoBooker</dt><dd className="s" style={row.status === "Send Error" ? { color: "var(--bad)" } : undefined}>{row.notes}</dd></>}
          {row.research && !row.signal && <><dt>Research</dt><dd className="s">{row.research}</dd></>}
        </dl>
        {row.body ? (
          <div>
            <div className="hint" style={{ marginBottom: 6 }}>{editable ? "Draft (editable before approval)" : "Email"}</div>
            <div className="draft">
              <div className="subj">Subject: <input value={subject} onChange={(e) => setSubject(e.target.value)} readOnly={!editable} aria-label="Subject" /></div>
              <div style={{ padding: "8px 12px 0", color: "var(--fg-3)", fontSize: 13 }}>Hi {row.name.split(" ")[0] || "there"},</div>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} readOnly={!editable} aria-label="Email body" />
            </div>
            <div className="checks" style={{ marginTop: 8 }}>
              {checks.map(([label, ok]) => <span key={label} className={`pill ${ok ? "ok" : "bad"}`}>{ok ? "✓" : "✗"} {label}</span>)}
            </div>
          </div>
        ) : (
          <div className="hint">No draft on this row.</div>
        )}
      </div>
      <div className="dfoot">{foot}</div>
    </>
  );
}

function LeftOutView({ row, onClose }: { row: LeftOutRow; onClose: () => void }) {
  return (
    <>
      <Header title={row.company || "Unknown company"} sub={`${row.tab} · stopped at gate ${row.failed_gate || "?"}`} onClose={onClose} />
      <div className="dbody">
        <div className="signal"><b>Not sent:</b> {row.why} <span className="tag">{row.reason}</span></div>
        <dl className="kv">
          <dt>Contact</dt><dd>{row.name ? `${row.name}${row.title ? `, ${row.title}` : ""}` : "Not identified"}</dd>
          <dt>Email</dt><dd>{row.email || <Pill tone="bad">None</Pill>}</dd>
          <dt>Gates</dt><dd><Pill tone="bad">Stopped at gate {row.failed_gate || "?"}</Pill> <span className="hint">{row.reason}</span></dd>
          <dt>Location</dt><dd>{row.location || "-"}</dd>
          <dt>Campaign</dt><dd>{row.campaign}</dd>
          <dt>Run</dt><dd className="mono" style={{ fontSize: 12 }}>{row.run_id}</dd>
        </dl>
        <div className="hint">Held-back leads are never emailed. A later search may find a different contact at this company.</div>
      </div>
      <div className="dfoot"><button className="btn" onClick={onClose}>Close</button></div>
    </>
  );
}
