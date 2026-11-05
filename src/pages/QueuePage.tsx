import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { PipelineRow } from "../api/types";
import { Drawer, useLiveItem, type DrawerItem } from "../components/Drawer";
import { Banner, Loading } from "../components/ui";
import { useData } from "../context/DataContext";
import { ageText, firstName, whenText, withoutGreeting } from "../utils/format";
import { isReviewable } from "../utils/jobs";

const PAGE_SIZE = 10;

/** Drafts written within this many minutes of each other, by the same campaign, belong to one run. */
const RUN_GAP_MS = 10 * 60_000;

const draftedMs = (r: PipelineRow) => (r.drafted_at ? Date.parse(r.drafted_at) : NaN);

/**
 * Newest drafts first. The draft time comes from the ledger; a row written before the ledger kept it goes after
 * every dated row, and within a tab a lower row in the Sheet (written later) comes first.
 */
export function newestFirst(a: PipelineRow, b: PipelineRow): number {
  const ta = draftedMs(a), tb = draftedMs(b);
  if (!Number.isNaN(ta) || !Number.isNaN(tb)) {
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    if (ta !== tb) return tb - ta;
  }
  if (a.tab !== b.tab) return a.tab.localeCompare(b.tab);
  return b.row_number - a.row_number;
}

/**
 * Splits the sorted queue into runs: a new run starts when the campaign changes or the gap to the previous draft
 * is more than RUN_GAP_MS. Rows with no draft time share run "". Returns the run of each row and each run's size.
 */
function groupRuns(sorted: PipelineRow[]): { runOf: Map<PipelineRow, string>; size: Map<string, number> } {
  const runOf = new Map<PipelineRow, string>();
  const size = new Map<string, number>();
  let run = 0;
  let prev: PipelineRow | undefined;
  for (const r of sorted) {
    const t = draftedMs(r);
    let key = "";
    if (!Number.isNaN(t)) {
      const pt = prev ? draftedMs(prev) : NaN;
      const same = prev && !Number.isNaN(pt) && (prev.campaign ?? prev.tab) === (r.campaign ?? r.tab) && pt - t <= RUN_GAP_MS;
      if (!same) run += 1;
      key = String(run);
    }
    runOf.set(r, key);
    size.set(key, (size.get(key) ?? 0) + 1);
    prev = r;
  }
  return { runOf, size };
}

/**
 * The review queue: drafts from both pipelines, 10 to a page, the most recent run first.
 * Keyboard: ↑ ↓ choose a draft, A approve, R reject, E edit, ← → change page.
 */
export function QueuePage() {
  const { rows, loading, error, act } = useData();
  const queue = useMemo(() => rows.filter((r) => isReviewable(r.status)).sort(newestFirst), [rows]);
  const pages = Math.max(1, Math.ceil(queue.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState<DrawerItem>();
  const [busy, setBusy] = useState<string>();
  const live = useLiveItem(open);
  const listTop = useRef<HTMLDivElement>(null);

  const p = Math.min(page, pages - 1);
  const start = p * PAGE_SIZE;
  const shown = queue.slice(start, start + PAGE_SIZE);
  const s = Math.min(sel, Math.max(0, shown.length - 1));
  const current = shown[s];

  // Which run each draft belongs to, and how many drafts each run has in the whole queue, for the run headings.
  const runs = useMemo(() => groupRuns(queue), [queue]);
  const runKey = (r: PipelineRow) => runs.runOf.get(r) ?? "";

  const goPage = (n: number) => {
    setPage(Math.max(0, Math.min(pages - 1, n)));
    setSel(0);
    listTop.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const decide = async (row: PipelineRow | undefined, action: "approve" | "reject") => {
    if (!row || busy) return;
    setBusy(row.email);
    try { await act(row, action); } finally { setBusy(undefined); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return; // a held-down key must not approve row after row
      if (open || e.metaKey || e.ctrlKey || e.altKey || /^(input|textarea|select)$/i.test((e.target as HTMLElement).tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "a") void decide(current, "approve");
      else if (k === "r") void decide(current, "reject");
      else if (k === "e" && current) setOpen({ kind: "row", row: current });
      else if (e.key === "ArrowDown") { e.preventDefault(); setSel(Math.min(s + 1, shown.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel(Math.max(0, s - 1)); }
      else if (e.key === "ArrowRight") goPage(p + 1);
      else if (e.key === "ArrowLeft") goPage(p - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Keep the chosen draft on screen when moving with the keyboard.
  useEffect(() => {
    document.getElementById(`q-${start + s}`)?.scrollIntoView({ block: "nearest" });
  }, [start, s]);

  if (loading) return <Loading />;

  const pager = (
    <div className="pager">
      <button className="btn sm" disabled={p === 0} onClick={() => goPage(0)} aria-label="First page">«</button>
      <button className="btn sm" disabled={p === 0} onClick={() => goPage(p - 1)}>← Newer</button>
      <span className="hint">Page <b>{p + 1}</b> of {pages}</span>
      <button className="btn sm" disabled={p >= pages - 1} onClick={() => goPage(p + 1)}>Older →</button>
      <button className="btn sm" disabled={p >= pages - 1} onClick={() => goPage(pages - 1)} aria-label="Last page">»</button>
    </div>
  );

  return (
    <section className="view">
      {error && <Banner tone="bad">{error}</Banner>}
      <div className="card qbar" ref={listTop}>
        <div>
          <b>{queue.length ? `${start + 1}–${start + shown.length} of ${queue.length}` : "0 of 0"}</b>{" "}
          <span className="hint">waiting for a decision, newest run first. Keyboard: ↑ ↓ choose, A approve, R reject, E edit, ← → page.</span>
        </div>
        <div style={{ flex: 1 }} />
        {queue.length > PAGE_SIZE && pager}
      </div>

      {queue.length === 0 && (
        <div className="card"><div className="empty">Nothing waiting. New drafts arrive after a job search (Runs page → Start search).</div></div>
      )}

      {shown.map((row, i) => {
        const key = runKey(row);
        const newRun = i === 0 || runKey(shown[i - 1]!) !== key;
        const chosen = i === s;
        return (
          <Fragment key={`${row.tab}:${row.email}`}>
            {newRun && (
              <div className="qrun">
                {key
                  ? <>Run of <b>{whenText(row.drafted_at)}</b> · {row.campaign ?? row.tab} · {runs.size.get(key) ?? 0} waiting</>
                  : <>Earlier drafts (time not recorded)</>}
              </div>
            )}
            <article id={`q-${start + i}`} className={`card qcard${chosen ? " chosen" : ""}`} onClick={() => setSel(i)} aria-current={chosen || undefined}>
              <div className="qhead">
                <div>
                  <div className="qname">{row.name || row.email}{row.title ? ` · ${row.title}` : ""}</div>
                  <div className="s" style={{ color: "var(--fg-2)" }}>
                    {row.company} · <span className="mono" style={{ fontSize: 12 }}>{row.email}</span> · <span className="tag">{row.tab}</span>
                    {row.status === "Needs Rewrite" && <> · <span className="pill warn">Needs Rewrite</span></>}
                  </div>
                </div>
                <div className="hint qnum">#{start + i + 1}</div>
              </div>
              {row.signal && (
                <div className="signal"><b>They are hiring:</b> {row.signal.role} · posted {ageText(row.signal.posted)}
                  {row.signal.url && <> · <a className="mono" href={row.signal.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{row.signal.url.replace(/^https?:\/\/(www\.)?/, "")}</a></>}
                </div>
              )}
              <div className="draft">
                <div className="subj">Subject: <b>{row.subject}</b></div>
                <div className="qbody">
                  Hi {firstName(row.name) || "there"},{"\n\n"}{withoutGreeting(row.body)}
                  {"\n\n"}<span className="hint">Signature and opt-out line are added by AutoBooker at send time.</span>
                </div>
              </div>
              <div className="qactions">
                <button className="btn primary" disabled={!!busy} onClick={(e) => { e.stopPropagation(); void decide(row, "approve"); }}>
                  {busy === row.email ? "Saving…" : `Approve${chosen ? " (A)" : ""}`}
                </button>
                <button className="btn" onClick={(e) => { e.stopPropagation(); setOpen({ kind: "row", row }); }}>Edit{chosen ? " (E)" : ""}</button>
                <button className="btn danger" disabled={!!busy} onClick={(e) => { e.stopPropagation(); void decide(row, "reject"); }}>Reject{chosen ? " (R)" : ""}</button>
              </div>
            </article>
          </Fragment>
        );
      })}

      {queue.length > PAGE_SIZE && <div className="card qbar" style={{ justifyContent: "center" }}>{pager}</div>}
      <Drawer item={live} onClose={() => setOpen(undefined)} />
    </section>
  );
}
