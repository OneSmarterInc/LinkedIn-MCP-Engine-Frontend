import { useData } from "../../context/DataContext";
import { sinceText } from "../../utils/format";
import { isReviewable } from "../../utils/jobs";
import { PAGE_INFO, PAGES, type Page } from "../../pages/routes";

/** The dark left rail from the design: brand, the six pages with counts, and the Sheet status at the bottom. */
export function Rail({ page, campaignCount, runningCount }: { page: Page; campaignCount?: number; runningCount?: number }) {
  const { rows, leftOut, settings, syncedAt } = useData();
  const counts: Partial<Record<Page, number>> = {
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
      <div className="brand"><span className="dot" /> Outreach Console</div>
      {PAGES.map((p) => (
        <a key={p} className={`nav${page === p ? " active" : ""}`} href={`#${p}`} aria-current={page === p ? "page" : undefined}>
          {PAGE_INFO[p].label} {counts[p] !== undefined && <span className="n">{counts[p]}</span>}
        </a>
      ))}
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
