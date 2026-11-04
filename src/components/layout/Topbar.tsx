import { useState } from "react";

/** Page title and subtitle, the search box (on list pages), Refresh from Sheet, and Run job search. */
export function Topbar({ title, subtitle, query, onQuery, showSearch, onRefresh, onRunSearch }: {
  title: string;
  subtitle: string;
  query: string;
  onQuery: (q: string) => void;
  showSearch: boolean;
  onRefresh: () => Promise<void>;
  onRunSearch: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  return (
    <header className="topbar">
      <div><h1>{title}</h1><div className="sub">{subtitle}</div></div>
      <div className="grow" />
      {showSearch && (
        <label className="search">
          <span aria-hidden="true">⌕</span>
          <input type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search company, role, person, city" aria-label="Search" />
        </label>
      )}
      <button className="btn" disabled={syncing} onClick={async () => { setSyncing(true); await onRefresh(); setSyncing(false); }}>
        {syncing ? "Reading the Sheet…" : "Refresh from Sheet"}
      </button>
      <button className="btn primary" onClick={onRunSearch}>Run job search</button>
    </header>
  );
}
