import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/endpoints";
import type { CampaignSummary, RunSummary, RunView, SearchDefaults, SearchListItem, SearchRecord, SearchStage } from "../api/types";
import { Banner, Pill } from "../components/ui";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import { usePolling } from "../hooks/usePolling";
import { sinceText, whenText } from "../utils/format";

/** The five steps from the design, and which engine stages belong to each. */
const STEPS: [label: string, stages: SearchStage[]][] = [
  ["Search", ["starting", "searching"]],
  ["Emails", ["emails"]],
  ["Gates", ["syncing", "verifying"]],
  ["Draft", ["drafting"]],
  ["Sheet", ["exporting", "done"]],
];
const FALLBACK: SearchDefaults = { daysBack: 7, maxJobs: 10, maxSearches: 8, maxSeamlessLookups: 10 };
const tone = (s: string) => (s === "DONE" || s === "EXPORTED" ? "ok" : s === "FAILED" ? "bad" : "warn");
const finished = (s: string) => s === "DONE" || s === "EXPORTED" || s === "FAILED";

/** Start a job search (POST /api/search) or a campaign run (POST /api/runs) and watch each step. */
export function RunsPage({ autoStart, onAutoStarted, onRunning }: { autoStart: boolean; onAutoStarted: () => void; onRunning: (n: number) => void }) {
  const toast = useToast();
  const { refresh } = useData();
  const [search, setSearch] = useState<SearchRecord>();
  const [searches, setSearches] = useState<SearchListItem[]>([]);
  const [defaults, setDefaults] = useState<SearchDefaults>(FALLBACK);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [run, setRun] = useState<RunView>();
  const [campaign, setCampaign] = useState("");
  const [limit, setLimit] = useState(10);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();

  const loadLists = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([api.searches(10), api.runs(10)]);
      setSearches(s.searches);
      setDefaults(s.defaults);
      setRuns(r.runs);
      onRunning(s.searches.filter((x) => x.status === "RUNNING").length + r.runs.filter((x) => !finished(x.status)).length);
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [onRunning]);

  useEffect(() => {
    void loadLists();
    api.latestSearch().then(setSearch).catch(() => { /* no search yet */ });
    api.campaigns().then(({ campaigns: list }) => {
      const usable = list.filter((c) => c.status === "OK");
      setCampaigns(usable);
      setCampaign((cur) => cur || usable.find((c) => c.active)?.name || usable[0]?.name || "");
    }).catch(() => { /* shown on the Campaigns page */ });
  }, [loadLists]);

  const searchRunning = search?.status === "RUNNING";
  const runRunning = Boolean(run && !finished(run.status));

  // While something runs, ask the backend every 3 seconds. When it ends, reload the lists and the Sheet rows.
  usePolling(async () => {
    if (!search) return;
    const next = await api.search(search.search_id);
    setSearch(next);
    if (next.log.length !== search.log.length) void loadLists();
    if (next.status === "RUNNING") return;
    void loadLists();
    void refresh(true);
    const o = next.result?.outreach;
    if (next.status === "FAILED") toast(`Job search failed: ${next.error}`, true);
    else if (o) toast(`Job search done: ${o.pipeline_added} drafts are in the review queue`);
    else toast(`Job search done, but writing to the Sheet failed: ${next.result?.outreach_error ?? "unknown"}`, true);
  }, 3000, searchRunning);

  usePolling(async () => {
    if (!run) return;
    const next = await api.run(run.run_id);
    setRun(next);
    if (!finished(next.status)) return;
    void loadLists();
    void refresh(true);
    toast(next.status === "FAILED" ? `Run failed: ${next.error}` : `Run done: ${next.counts.drafted ?? 0} drafts in the Pipeline tab`, next.status === "FAILED");
  }, 3000, runRunning);

  const startSearch = useCallback(async () => {
    setStarting(true);
    try {
      const { search_id } = await api.startSearch();
      setSearch(await api.search(search_id));
      toast("Job search started. Each step appears in the live log.");
      void loadLists();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setStarting(false);
    }
  }, [toast, loadLists]);

  // "Run job search" in the top bar opens this page and starts a search.
  useEffect(() => {
    if (!autoStart) return;
    onAutoStarted();
    void startSearch();
  }, [autoStart, onAutoStarted, startSearch]);

  const startRun = async () => {
    try {
      const { run_id } = await api.startRun(campaign, limit);
      setRun(await api.run(run_id));
      toast(`Run started for ${campaign}`);
      void loadLists();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };

  const p = search?.progress;
  const r = search?.result;
  const stage = search?.status === "DONE" ? STEPS.length : STEPS.findIndex(([, stages]) => stages.includes(p?.stage ?? "starting"));
  const pct = search?.status === "DONE" ? 100 : search ? Math.max(5, Math.round(((stage + 0.5) / STEPS.length) * 100)) : 0;

  const history = useMemo(() => [
    ...searches.map((s) => ({ key: s.search_id, at: s.started_at, kind: "Job search", camp: "Job search", found: s.total, email: s.with_email, passed: undefined as number | undefined, sheet: s.drafts, status: s.status })),
    ...runs.map((x) => ({ key: x.run_id, at: x.created_at, kind: "Campaign run", camp: x.campaign, found: x.leads, email: undefined as number | undefined, passed: x.passed, sheet: x.drafts, status: x.status })),
  ].sort((a, b) => b.at.localeCompare(a.at)), [searches, runs]);

  const num = (n?: number) => (n === undefined ? "-" : n);

  return (
    <section className="view">
      {error && <Banner tone="bad">{error}</Banner>}
      <div className="run">
        <div className="card prog">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b>Job search</b>
            <span className={`pill ${search ? tone(search.status) : "info"}`}>{search?.status ?? "Idle"}</span>
            {search && <span className="hint mono">{search.search_id.slice(0, 13)}… · {sinceText(search.started_at)}</span>}
          </div>
          <div className="steps">
            {STEPS.map(([label], i) => (
              <div key={label} className={`step${i < stage ? " done" : i === stage && searchRunning ? " now" : ""}`}>{label}</div>
            ))}
          </div>
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <dl className="kv">
            <dt>Searches</dt><dd>{r?.searches ?? p?.searches_done ?? 0} of {defaults.maxSearches}</dd>
            <dt>Jobs kept</dt><dd>{r?.total ?? p?.jobs_found ?? 0} of {defaults.maxJobs}</dd>
            <dt>With email</dt><dd>{r?.with_email ?? p?.with_email ?? 0}</dd>
            <dt>Credits used</dt><dd>{r?.seamless_lookups_used ?? p?.lookups_used ?? 0}</dd>
            {r?.outreach && <><dt>To the Sheet</dt><dd>{r.outreach.pipeline_added} drafts, {r.outreach.quarantined_added} held back</dd></>}
          </dl>
          {search?.status === "FAILED" && <Banner tone="bad">{search.error}</Banner>}
          {r?.outreach_error && <Banner tone="bad">Writing to the Sheet failed: {r.outreach_error}</Banner>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn primary" disabled={searchRunning || starting} onClick={startSearch}>{searchRunning ? "Running…" : "Start search"}</button>
            <span className="hint" style={{ alignSelf: "center" }}>3 to 8 minutes. Up to {defaults.maxSeamlessLookups} Seamless lookups.</span>
          </div>
        </div>
        <div className="card prog">
          <b>Live log</b>
          <div className="log" aria-live="polite">
            {!search?.log.length
              ? `Press Start to search LinkedIn posts and listings from the last ${defaults.daysBack} days.`
              : search.log.map((line, i) => (
                <div key={i} className={/^Email found/.test(line) ? "hot" : /^Done|drafts? in Jobs_Pipeline/.test(line) ? "ok" : ""}>{line}</div>
              ))}
          </div>
        </div>
      </div>

      <div className="card prog">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <b>Campaign run</b>
          {run && <Pill tone={tone(run.status)}>{run.status}</Pill>}
          {run?.message && <span className="hint">{run.message}</span>}
        </div>
        <div className="field">
          <label className="field">Campaign
            <select value={campaign} onChange={(e) => setCampaign(e.target.value)}>
              {campaigns.length === 0 && <option value="">No valid campaign</option>}
              {campaigns.map((c) => <option key={c.name} value={c.name}>{c.name}{c.active ? "" : " (paused)"}</option>)}
            </select>
          </label>
          <label className="field">Leads <input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ width: 70 }} /></label>
          <button className="btn" disabled={!campaign || runRunning} onClick={startRun}>{runRunning ? "Running…" : "Start run"}</button>
          <span className="hint">Find leads → 5 gates → AI drafts → Pipeline tab as Ready for Review.</span>
        </div>
        {run && (
          <dl className="kv">
            <dt>Found</dt><dd>{run.counts.sourced}</dd>
            <dt>Passed gates</dt><dd>{num(run.counts.passed)}</dd>
            <dt>Drafted</dt><dd>{num(run.counts.drafted)}</dd>
          </dl>
        )}
        {run?.error && <Banner tone="bad">{run.error}</Banner>}
      </div>

      <h2 className="sec">Recent runs</h2>
      <div className="card"><div className="tablewrap"><table>
        <thead><tr><th>Started</th><th>Kind</th><th>Campaign</th><th>Found</th><th>With email</th><th>Passed</th><th>To Sheet</th><th>Status</th></tr></thead>
        <tbody>
          {history.length === 0 && <tr><td colSpan={8} className="empty">No runs yet.</td></tr>}
          {history.map((h) => (
            <tr key={h.key}>
              <td className="s">{whenText(h.at)}</td>
              <td>{h.kind}</td>
              <td className="s">{h.camp}</td>
              <td className="mono">{num(h.found)}</td>
              <td className="mono">{num(h.email)}</td>
              <td className="mono">{num(h.passed)}</td>
              <td className="mono">{num(h.sheet)}</td>
              <td><span className={`pill ${tone(h.status)}`}>{h.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>
    </section>
  );
}
