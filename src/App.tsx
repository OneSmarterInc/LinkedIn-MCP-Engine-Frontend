import { useEffect, useState } from "react";
import { api, ApiError, getToken, setToken } from "./api";
import { ToastProvider } from "./components/ui";
import { JobsPage } from "./pages/JobsPage";
import { QueuePage } from "./pages/QueuePage";
import { PipelinePage } from "./pages/PipelinePage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { RunsPage } from "./pages/RunsPage";
import { AutomationPage } from "./pages/AutomationPage";

type Page = "queue" | "jobs" | "pipeline" | "campaigns" | "runs" | "automation";
const PAGES: Array<{ id: Page; label: string; title: string; sub: string }> = [
  { id: "queue", label: "Review queue", title: "Review queue", sub: "Drafts waiting for a yes or no" },
  { id: "jobs", label: "Job posts", title: "Job posts", sub: "LinkedIn hiring posts that produced a contact" },
  { id: "pipeline", label: "Pipeline", title: "Pipeline", sub: "Every row in the Sheet, every status" },
  { id: "campaigns", label: "Campaigns", title: "Campaigns", sub: "Saved searches: who to look for and what to offer" },
  { id: "runs", label: "Runs", title: "Runs", sub: "Find new posts or leads; nothing here sends email" },
  { id: "automation", label: "Automation", title: "Automation", sub: "What AutoBooker does on its own" },
];
const readHash = (): Page => { const h = location.hash.replace("#", "") as Page; return PAGES.some((p) => p.id === h) ? h : "queue"; };

/** Asks for the API token once when the server has API_TOKEN set. Stored in this browser only. */
function TokenGate({ onDone }: { onDone: () => void }) {
  const [t, setT] = useState(getToken());
  const [err, setErr] = useState("");
  async function go() {
    setToken(t.trim());
    try { await api.summary(); onDone(); } catch (e) { setErr(e instanceof ApiError && e.status === 401 ? "That token was not accepted." : (e as Error).message); }
  }
  return <div className="gate"><div className="card" style={{ padding: 20, maxWidth: 380, width: "100%" }}>
    <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>Sign in</h2>
    <p className="s" style={{ margin: "0 0 12px" }}>Paste the API token from the server's <span className="mono">.env</span> (API_TOKEN). It stays in this browser.</p>
    <input value={t} onChange={(e) => setT(e.target.value)} type="password" placeholder="API token" style={{ width: "100%", padding: 8, border: "1px solid var(--line)", borderRadius: 6, marginBottom: 10 }} onKeyDown={(e) => e.key === "Enter" && void go()} />
    {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
    <button className="btn primary" onClick={() => void go()}>Continue</button>
  </div></div>;
}

export default function App() {
  const [page, setPage] = useState<Page>(readHash());
  const [needToken, setNeedToken] = useState<boolean | null>(null);
  const [counts, setCounts] = useState<{ queue?: number; jobs?: number }>({});
  const [health, setHealth] = useState<{ sheet: boolean; auth: boolean } | null>(null);

  useEffect(() => { const h = () => setPage(readHash()); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
  useEffect(() => {
    api.health().then(async (h) => {
      setHealth(h);
      if (!h.auth) return setNeedToken(false);
      try { await api.summary(); setNeedToken(false); } catch (e) { setNeedToken(e instanceof ApiError && e.status === 401); }
    }).catch(() => setNeedToken(false));
  }, []);
  // Any later 401 (token changed on the server) sends the user back to the gate.
  useEffect(() => {
    const orig = window.fetch;
    window.fetch = async (...a) => { const r = await orig(...a); if (r.status === 401 && String(a[0]).includes("/api/")) setNeedToken(true); return r; };
    return () => { window.fetch = orig; };
  }, []);

  if (needToken === null) return <div className="gate"><div className="s">Connecting to the API…</div></div>;
  if (needToken) return <TokenGate onDone={() => setNeedToken(false)} />;
  const cur = PAGES.find((p) => p.id === page)!;

  return <ToastProvider><div className="app">
    <nav className="rail" aria-label="Sections">
      <div className="brand"><span className="dot" />Outreach Console</div>
      {PAGES.map((p) => <a key={p.id} href={`#${p.id}`} className={`nav ${page === p.id ? "active" : ""}`}>{p.label}{p.id === "queue" && counts.queue !== undefined && <span className="n">{counts.queue}</span>}{p.id === "jobs" && counts.jobs !== undefined && <span className="n">{counts.jobs}</span>}</a>)}
      <div className="foot"><b>System of record:</b> the Google Sheet. This page reads and writes the same tabs AutoBooker uses.{health && !health.sheet && <div style={{ color: "var(--bad)", marginTop: 6 }}>GOOGLE_SHEET_ID is not set on the server.</div>}</div>
    </nav>
    <div className="main">
      <header className="topbar"><div><h1>{cur.title}</h1><div className="sub">{cur.sub}</div></div><div className="grow" /><button className="btn sm" onClick={() => location.reload()}>Refresh</button></header>
      <main className="content">
        {page === "queue" && <QueuePage onCount={(n) => setCounts((c) => (c.queue === n ? c : { ...c, queue: n }))} />}
        {page === "jobs" && <JobsPage onCount={(n) => setCounts((c) => (c.jobs === n ? c : { ...c, jobs: n }))} />}
        {page === "pipeline" && <PipelinePage />}
        {page === "campaigns" && <CampaignsPage />}
        {page === "runs" && <RunsPage />}
        {page === "automation" && <AutomationPage />}
      </main>
    </div>
  </div></ToastProvider>;
}
