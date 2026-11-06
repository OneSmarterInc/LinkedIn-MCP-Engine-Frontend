import { Fragment, type ReactElement } from "react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { sinceText } from "../../utils/format";
import { isReviewable } from "../../utils/jobs";
import { PAGE_INFO, PAGES, type Page } from "../../pages/routes";

const ICONS: Record<Page, ReactElement> = {
  queue: <svg viewBox="0 0 20 20"><path d="M3 11l2.5-6h9L17 11v5H3z"/><path d="M3 11h4l1.5 2h3L13 11h4"/></svg>,
  jobs: <svg viewBox="0 0 20 20"><rect x="3" y="6" width="14" height="10" rx="2"/><path d="M7 6V4.5A1.5 1.5 0 018.5 3h3A1.5 1.5 0 0113 4.5V6M3 10h14"/></svg>,
  pipeline: <svg viewBox="0 0 20 20"><path d="M4 5h12M4 10h12M4 15h8"/><circle cx="16" cy="15" r="1.5"/></svg>,
  campaigns: <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="10" r="3"/><circle cx="10" cy="10" r=".8"/></svg>,
  runs: <svg viewBox="0 0 20 20"><path d="M6 4.5v11l9-5.5z"/></svg>,
  automation: <svg viewBox="0 0 20 20"><path d="M11 3L5 11h4.5L9 17l6-8h-4.5z"/></svg>,
  users: <svg viewBox="0 0 20 20"><circle cx="8" cy="7" r="3"/><path d="M2.5 16c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5"/><circle cx="14.5" cy="8" r="2.2"/><path d="M14 11.8c2 .2 3.3 1.5 3.7 3.7"/></svg>,
};
const GROUP_BEFORE: Partial<Record<Page, string>> = { queue: "Work", campaigns: "Set up", users: "People" };

/** The dark left rail from the design: brand, the six pages with counts, and the Sheet status at the bottom. */
export function Rail({ page, campaignCount, runningCount, onToggle, onNavigate, hide = [] }: { page: Page; campaignCount?: number; runningCount?: number; onToggle?: () => void; onNavigate?: () => void; hide?: readonly Page[] }) {
  const { rows, leftOut, settings, syncedAt } = useData();
  const { me, accounts, signOut } = useAuth();
  const counts: Partial<Record<Page, number>> = {
    ...(me?.pending_users ? { users: me.pending_users } : {}),
    queue: rows.filter((r) => isReviewable(r.status)).length,
    jobs: rows.filter((r) => r.tab === "Jobs_Pipeline").length + leftOut.filter((r) => r.tab === "Jobs_Quarantine").length,
    pipeline: rows.length,
    ...(campaignCount !== undefined ? { campaigns: campaignCount } : {}),
    ...(runningCount ? { runs: runningCount } : {}),
  };
  const sentTotal = rows.filter((r) => ["Sent", "Replied", "Meeting Booked"].includes(r.status)).length;
  const live = settings ? (settings.DryRun ?? "TRUE").toUpperCase() === "FALSE" : undefined;

  return (
    <nav className="rail" aria-label="Sections">
      <div className="brand">
        <span className="mark" aria-hidden="true">O</span><span>Outreach Console</span>
        {onToggle && <button type="button" className="burger rail-burger" onClick={onToggle} aria-label="Hide menu"><span /><span /><span /></button>}
      </div>
      {PAGES.filter((p) => !hide.includes(p)).map((p) => (
        <Fragment key={p}>
          {GROUP_BEFORE[p] && <div className="navlbl">{GROUP_BEFORE[p]}</div>}
          <a className={`nav${page === p ? " active" : ""}`} href={`#${p}`} onClick={onNavigate} aria-current={page === p ? "page" : undefined}>
            <span className="ic" aria-hidden="true">{ICONS[p]}</span>{PAGE_INFO[p].label} {counts[p] !== undefined && <span className="n">{counts[p]}</span>}
          </a>
        </Fragment>
      ))}
      {accounts && me && (
        <div className="who">
          <div className="t">{me.user.full_name}</div>
          <div className="s">{me.user.role === "admin" ? "Administrator" : "Member"}</div>
          <button type="button" className="btn sm" onClick={() => void signOut()}>Sign out</button>
        </div>
      )}
      <div className="foot">
        <b>Google Sheet</b><br />
        {syncedAt ? `Last sync ${sinceText(new Date(syncedAt).toISOString())}` : "Not synced yet"}<br />
        Sender: AutoBooker, every 15 min<br />
        {live === undefined ? "Settings not read yet" : live ? "Live sending" : "Dry run: nothing is sent"}<br />
        {settings ? `Daily cap ${settings.DailySendCap || 20}, sent so far ${sentTotal}` : ""}
      </div>
    </nav>
  );
}
