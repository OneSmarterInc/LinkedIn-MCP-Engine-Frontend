import { useEffect, useMemo, useState } from "react";
import type { PipelineRow } from "../api/types";
import { Banner, Loading, Pill, Stat } from "../components/ui";
import { useData } from "../context/DataContext";
import { firstName, gmailThread, whenText, withoutGreeting } from "../utils/format";
import { filterOf, isNewReply, isoOf, KIND_PILL, markSeen, noteLines, seenAt, SENT_KINDS, sentRows, sheetTime, type SentKind } from "../utils/sent";

const PAGE_SIZE = 20;
const DAY = 86_400_000;

/**
 * Sent & replies: every email AutoBooker sent, and what came back. The list is the Pipeline rows that were sent;
 * the reply text is AutoBooker's LastReply column (P). Picking a row shows the conversation on the right.
 */
export function SentPage({ query = "" }: { query?: string }) {
  const { rows, loading, error, act } = useData();
  const [filter, setFilter] = useState<SentKind | "all">("all");
  const [selKey, setSelKey] = useState<string>();
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  // Replies newer than the last visit get a dot. The time is read once, then this visit counts as seen.
  const [since] = useState(seenAt);
  useEffect(() => { markSeen(); }, []);

  const all = useMemo(() => sentRows(rows), [rows]);
  const now = Date.now();
  const today = new Date().toDateString();
  const count = (k: SentKind | "all") => (k === "all" ? all.length : all.filter((r) => filterOf(r.kind) === k).length);
  const sentToday = all.filter((r) => new Date(sheetTime(r.sent_at)).toDateString() === today).length;
  const answered = all.filter((r) => ["replied", "meeting", "not_now"].includes(r.kind)).length;
  const fresh = all.filter((r) => isNewReply(r, since)).length;
  const waitingLong = all.filter((r) => r.kind === "no_reply" && now - sheetTime(r.sent_at) > 4 * DAY).length;
  const bounced = all.filter((r) => r.kind === "bounced").length;
  const opted = all.filter((r) => r.kind === "opted_out").length;

  const q = query.trim().toLowerCase();
  const list = all.filter((r) => (filter === "all" || filterOf(r.kind) === filter)
    && (!q || [r.name, r.company, r.subject, r.email, r.title].some((v) => v?.toLowerCase().includes(q))));
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const p = Math.min(page, pages - 1);
  const shown = list.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
  const key = (r: PipelineRow) => `${r.tab}:${r.email}`;
  const current = list.find((r) => key(r) === selKey) ?? shown[0];

  const mark = async (r: PipelineRow, what: "meetingBooked" | "notInterested") => {
    if (busy) return;
    setBusy(true);
    try { await act(r, what); } finally { setBusy(false); }
  };

  if (loading) return <Loading />;

  return (
    <section className="view">
      {error && <Banner tone="bad">{error}</Banner>}
      <div className="stats">
        <Stat label="Sent" value={all.length} small={`${sentToday} today`} />
        <Stat hot label="Replied" value={answered} small={`${all.length ? Math.round((answered / all.length) * 100) : 0}%${fresh ? ` · ${fresh} new` : ""}`} />
        <Stat label="Meetings booked" value={count("meeting")} />
        <Stat label="No reply yet" value={count("no_reply")} small={waitingLong ? `${waitingLong} over 4 days` : undefined} />
        <Stat label="Bounced / opted out" value={bounced + opted} small={`${bounced} · ${opted}`} />
      </div>

      <div className="sent-filters">
        <div className="seg" role="tablist">
          {SENT_KINDS.map(({ kind, label }) => (
            <button key={kind} className={filter === kind ? "on" : ""} onClick={() => { setFilter(kind); setPage(0); setSelKey(undefined); }}>
              {label} {count(kind)}
            </button>
          ))}
        </div>
      </div>

      {all.length === 0 ? (
        <div className="card"><div className="empty">Nothing sent yet. Approved drafts are sent by AutoBooker every 15 minutes once DryRun is FALSE in the Config tab.</div></div>
      ) : (
        <div className="sent-split">
          <div className="card">
            <div className="tablewrap">
              <table className="sent-table">
                <thead><tr><th>Sent</th><th>Person</th><th>Subject</th><th>Status</th><th>Last reply</th></tr></thead>
                <tbody>
                  {shown.length === 0 && <tr><td colSpan={5} className="empty">No emails match.</td></tr>}
                  {shown.map((r) => {
                    const pill = KIND_PILL[r.kind];
                    const waited = Math.floor((now - sheetTime(r.sent_at)) / DAY);
                    return (
                      <tr key={key(r)} className={`row${current && key(current) === key(r) ? " sel" : ""}`} onClick={() => setSelKey(key(r))}>
                        <td className="sent-when">{whenText(isoOf(r.sent_at)) || "–"}</td>
                        <td>
                          <div className="t">{isNewReply(r, since) && <span className="sent-dot" title="New reply since your last visit" />}{r.name || r.email}</div>
                          <div className="s">{[r.title, r.company].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td><div className="s">{r.subject}</div></td>
                        <td><Pill tone={pill.tone}>{pill.label}</Pill></td>
                        <td>
                          {r.last_reply_at
                            ? <><div className="sent-when">{whenText(isoOf(r.last_reply_at))}</div><div className="sent-snip">{r.last_reply || "Open in Gmail to read it"}</div></>
                            : <><div className="sent-when">No reply</div><div className="s">{Number.isNaN(waited) ? "" : waited < 1 ? "sent today" : `${waited} day${waited === 1 ? "" : "s"} ago`}</div></>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="sent-foot">
              <span>{list.length ? `${p * PAGE_SIZE + 1}–${p * PAGE_SIZE + shown.length} of ${list.length}` : "0 of 0"}</span>
              {fresh > 0 && <span><span className="sent-dot" /> new reply since your last visit</span>}
              <span style={{ flex: 1 }} />
              {pages > 1 && <>
                <button className="btn sm" disabled={p === 0} onClick={() => setPage(p - 1)}>← Newer</button>
                <span>Page {p + 1} of {pages}</span>
                <button className="btn sm" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>Older →</button>
              </>}
            </div>
          </div>

          {current && <Conversation row={current} busy={busy} onMark={(w) => void mark(current, w)} />}
        </div>
      )}
    </section>
  );
}

function Conversation({ row, busy, onMark }: { row: PipelineRow & { kind: SentKind }; busy: boolean; onMark: (what: "meetingBooked" | "notInterested") => void }) {
  const pill = KIND_PILL[row.kind];
  const open = row.status === "Sent" || row.status === "Replied";
  return (
    <aside className="card sent-thread">
      <div className="sent-thead">
        <div className="t">{row.name || row.email}{row.company ? ` · ${row.company}` : ""}</div>
        <div className="s">{[row.title, row.email].filter(Boolean).join(" · ")}</div>
        <div className="sent-tags">
          <Pill tone={pill.tone}>{pill.label}</Pill>
          <span className="tag">{row.tab}</span>
          {row.signal?.role && <span className="tag">Job: {row.signal.role}</span>}
        </div>
      </div>
      <div className="sent-msgs">
        <div className="sent-msg">
          <div className="h"><b>You (AutoBooker)</b><span>{whenText(isoOf(row.sent_at))}</span></div>
          <p><b>{row.subject}</b></p>
          <p className="sent-body">Hi {firstName(row.name) || "there"},{"\n\n"}{withoutGreeting(row.body)}</p>
        </div>
        {row.last_reply_at && (
          <div className={`sent-msg them${row.kind === "bounced" ? " bad" : ""}`}>
            <div className="h"><b>{row.kind === "bounced" ? "Mail server" : row.name || row.email}</b><span>{whenText(isoOf(row.last_reply_at))}</span></div>
            <p>{row.last_reply || "The reply text is not saved yet (AutoBooker saves it from now on). Open the thread in Gmail to read it."}</p>
          </div>
        )}
        {noteLines(row.notes).map((n, i) => (
          <div key={i} className="sent-event">{n.text}{n.at ? ` · ${whenText(isoOf(n.at))}` : ""}</div>
        ))}
      </div>
      <div className="sent-actions">
        {row.thread_id && <a className="btn primary" href={gmailThread(row.thread_id)} target="_blank" rel="noopener noreferrer">Open in Gmail</a>}
        {open && <button className="btn" disabled={busy} onClick={() => onMark("meetingBooked")}>Mark meeting booked</button>}
        {open && row.kind !== "not_now" && <button className="btn" disabled={busy} onClick={() => { if (confirm(`Mark ${row.email} as not interested? AutoBooker stops answering this thread.`)) onMark("notInterested"); }}>Mark not interested</button>}
      </div>
    </aside>
  );
}
