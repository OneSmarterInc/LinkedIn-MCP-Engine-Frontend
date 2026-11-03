import { useEffect, useState } from "react";
import { api, ageText, type RunView, type SearchRecord } from "../api";
import { Err, usePoll, useToast } from "../components/ui";

/** Runs: start a job search or a campaign run, watch it, see what it produced. Nothing here sends email. */
export function RunsPage() {
  const toast = useToast();
  const [searchId, setSearchId] = useState<string | null>(() => sessionStorage.getItem("runs:searchId"));
  const [runId, setRunId] = useState<string | null>(() => sessionStorage.getItem("runs:runId"));
  useEffect(() => { try { if (searchId) sessionStorage.setItem("runs:searchId", searchId); if (runId) sessionStorage.setItem("runs:runId", runId); } catch { /* ignore */ } }, [searchId, runId]);
  const [campaign, setCampaign] = useState("");
  const [limit, setLimit] = useState(10);
  const [starting, setStarting] = useState<"search" | "run" | null>(null);

  const camps = usePoll("campaigns", () => api.campaigns().then((r) => r.campaigns), 120_000);
  const searches = usePoll("searches", () => api.searches(), 20_000);
  const runs = usePoll("runs", () => api.runs().then((r) => r.runs), 20_000);
  const search = usePoll<SearchRecord | null>(`search:${searchId ?? "none"}`, () => (searchId ? api.search(searchId) : Promise.resolve(null)), 3_000);
  const run = usePoll<RunView | null>(`run:${runId ?? "none"}`, () => (runId ? api.run(runId) : Promise.resolve(null)), 3_000);
  const searchDone = search.data && search.data.status !== "RUNNING";
  const runDone = run.data && ["EXPORTED", "DRAFTED", "FAILED"].includes(run.data.status);
  useEffect(() => { if (searchDone) void searches.refresh(); }, [searchDone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (runDone) void runs.refresh(); }, [runDone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!campaign && camps.data?.length) setCampaign((camps.data.find((c) => c.active) ?? camps.data[0]!).name); }, [camps.data, campaign]);
  useEffect(() => { if (!searchId && searches.data?.searches[0]) setSearchId(searches.data.searches[0].search_id); }, [searches.data, searchId]);

  async function startSearch() {
    setStarting("search");
    try { const r = await api.startSearch(); setSearchId(r.search_id); toast(`Job search started (campaign ${r.campaign}). This takes 3–6 minutes.`); }
    catch (e) { toast((e as Error).message, true); } finally { setStarting(null); }
  }
  async function startRun() {
    if (!campaign) return;
    setStarting("run");
    try { const r = await api.startRun(campaign, limit); setRunId(r.run_id); toast(`Run started for ${r.campaign}.`); }
    catch (e) { toast((e as Error).message, true); } finally { setStarting(null); }
  }

  const p = search.data?.progress;
  const pct = p ? (p.searches_max ? Math.min(100, Math.round((p.searches_done / p.searches_max) * 100)) : 0) : 0;
  const d = searches.data?.defaults;

  return <>
    <div className="run">
      <div className="card prog">
        <h3 style={{ margin: 0, fontSize: 14 }}>Find new job posts</h3>
        <p className="s" style={{ margin: 0 }}>Searches LinkedIn for "we're hiring" posts{d ? ` from the last ${d.daysBack} days (up to ${d.maxSearches} searches, ${d.maxJobs} posts, ${d.maxSeamlessLookups} email lookups)` : ""}, finds the poster's email, writes a draft, and adds rows to the Jobs_Pipeline tab. Drafts wait in the Review queue.</p>
        <div><button className="btn primary" disabled={starting === "search" || (search.data?.status === "RUNNING")} onClick={() => void startSearch()}>{search.data?.status === "RUNNING" ? "Running…" : "Start job search"}</button></div>
        {search.data && <>
          <div className="bar"><i style={{ width: `${search.data.status === "RUNNING" ? pct : 100}%`, background: search.data.status === "FAILED" ? "var(--bad)" : undefined }} /></div>
          <div className="s">{search.data.status === "RUNNING" ? `${p?.stage ?? "starting"} · ${p?.message ?? ""}` : search.data.status === "DONE" ? `Done: ${search.data.result?.total ?? 0} posts, ${search.data.result?.with_email ?? 0} with email, ${search.data.result?.outreach?.drafted ?? 0} drafts` : `Failed: ${search.data.error}`}</div>
          {p && <div className="s mono">searches {p.searches_done}/{p.searches_max} · posts {p.jobs_found} · emails {p.with_email} · lookups {p.lookups_used}</div>}
          <div className="log">{(search.data.log ?? []).slice(-40).join("\n") || "…"}</div>
          {!!(search.data.jobs_so_far?.length || search.data.result?.jobs.length) && <div className="tablewrap"><table style={{ minWidth: 0 }}><thead><tr><th>Role</th><th>Company</th><th>Email</th></tr></thead><tbody>
            {(search.data.result?.jobs ?? search.data.jobs_so_far ?? []).map((j, i) => <tr key={i}><td>{j.job_title}</td><td>{j.company}<div className="s">{j.location}</div></td><td className="mono" style={{ fontSize: 12 }}>{j.email ?? <span className="s">none ({j.email_source})</span>}</td></tr>)}
          </tbody></table></div>}
        </>}
        <Err msg={search.error} />
      </div>
      <div className="card prog">
        <h3 style={{ margin: 0, fontSize: 14 }}>Run a campaign</h3>
        <p className="s" style={{ margin: 0 }}>Finds people matching the campaign, runs the five checks, writes drafts, and adds rows to the Pipeline tab.</p>
        <div className="field">
          <select value={campaign} onChange={(e) => setCampaign(e.target.value)}>{(camps.data ?? []).map((c) => <option key={c.name} value={c.name}>{c.name}{c.active ? "" : " (off)"}</option>)}</select>
          <span>up to</span><input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ width: 70 }} /><span>leads</span>
          <button className="btn primary" disabled={!campaign || starting === "run" || run.data?.status === "SOURCING"} onClick={() => void startRun()}>Start run</button>
        </div>
        {run.data && <>
          <div className="bar"><i style={{ width: `${{ SOURCING: 20, SOURCED: 40, VERIFIED: 65, DRAFTED: 85, EXPORTED: 100, FAILED: 100 }[run.data.status] ?? 10}%`, background: run.data.status === "FAILED" ? "var(--bad)" : undefined }} /></div>
          <div className="s">{run.data.status} · {run.data.message ?? run.data.error ?? ""} · sourced {run.data.counts.sourced}{run.data.counts.passed !== undefined ? `, passed ${run.data.counts.passed}` : ""}{run.data.counts.drafted !== undefined ? `, drafted ${run.data.counts.drafted}` : ""}</div>
          {!!run.data.leads.length && <div className="tablewrap"><table style={{ minWidth: 0 }}><thead><tr><th>Name</th><th>Company</th><th>Result</th></tr></thead><tbody>
            {run.data.leads.map((l, i) => <tr key={i}><td>{l.name}<div className="s">{l.title}</div></td><td>{l.company}</td><td className="s">{l.result}{l.email ? <div className="mono" style={{ fontSize: 12 }}>{l.email}</div> : null}</td></tr>)}
          </tbody></table></div>}
        </>}
        <Err msg={run.error} />
      </div>
    </div>
    <div className="run">
      <div className="card">
        <div style={{ padding: "10px 14px", fontWeight: 600, fontSize: 14 }}>Recent job searches</div>
        <div className="tablewrap"><table style={{ minWidth: 0 }}><thead><tr><th>When</th><th>Status</th><th>Posts</th><th>Emails</th><th>Drafts</th></tr></thead><tbody>
          {(searches.data?.searches ?? []).map((s) => <tr key={s.search_id} className={`row ${s.search_id === searchId ? "sel" : ""}`} onClick={() => setSearchId(s.search_id)}><td className="age">{ageText(s.started_at)}</td><td>{s.status}</td><td>{s.total ?? "—"}</td><td>{s.with_email ?? "—"}</td><td>{s.drafts ?? "—"}</td></tr>)}
        </tbody></table></div>
      </div>
      <div className="card">
        <div style={{ padding: "10px 14px", fontWeight: 600, fontSize: 14 }}>Recent campaign runs</div>
        <div className="tablewrap"><table style={{ minWidth: 0 }}><thead><tr><th>When</th><th>Campaign</th><th>Status</th><th>Leads</th><th>Passed</th><th>Drafts</th></tr></thead><tbody>
          {(runs.data ?? []).map((r) => <tr key={r.run_id} className={`row ${r.run_id === runId ? "sel" : ""}`} onClick={() => setRunId(r.run_id)}><td className="age">{ageText(r.created_at)}</td><td>{r.campaign}</td><td>{r.status}</td><td>{r.leads}</td><td>{r.passed ?? "—"}</td><td>{r.drafts ?? "—"}</td></tr>)}
        </tbody></table></div>
      </div>
    </div>
  </>;
}
