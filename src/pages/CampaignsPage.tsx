import { useEffect, useState } from "react";
import { api, type Campaign, type CampaignSummary } from "../api";
import { Err, Switch, usePoll, useToast } from "../components/ui";

type Form = { name: string; mode: "CORPORATE" | "CANDIDATE"; provider: string; titles: string; states: string; keywords: string; offer: string; sender_company: string; persona: string; signal_query: string; meeting_minutes: number; daily_cap: number; active: boolean };
const empty: Form = { name: "", mode: "CORPORATE", provider: "gemini_xray", titles: "", states: "", keywords: "", offer: "", sender_company: "One Smarter", persona: "", signal_query: "", meeting_minutes: 15, daily_cap: 20, active: false };
const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const fromCampaign = (c: Campaign): Form => ({ name: c.campaign_name, mode: c.mode, provider: c.sourcing_provider, titles: c.decision_maker_titles.join(", "), states: c.target_geography.join(", "), keywords: c.industry_keywords.join(", "), offer: c.offer ?? "", sender_company: c.sender_company ?? "", persona: c.outreach_persona ?? "", signal_query: "", meeting_minutes: c.calendar_duration_minutes, daily_cap: c.daily_send_cap, active: false });

/** Campaigns: the Campaigns tab of the Sheet. Who to look for, what to offer, how many a day. */
export function CampaignsPage() {
  const toast = useToast();
  const camps = usePoll("campaigns", () => api.campaigns().then((r) => r.campaigns), 60_000);
  const [editing, setEditing] = useState<string | null>(null); // "" = new
  const [form, setForm] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (editing === null || editing === "") return;
    api.campaign(editing).then((c) => setForm(fromCampaign(c))).catch((e) => toast((e as Error).message, true));
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(c: CampaignSummary) {
    try { await api.setActive(c.name, !c.active); camps.setData((camps.data ?? []).map((x) => (x.name === c.name ? { ...x, active: !c.active } : x))); toast(!c.active ? `${c.name} is on. It runs when someone starts it on the Runs page or via run-active.` : `${c.name} is off.`); }
    catch (e) { toast((e as Error).message, true); }
  }
  async function save() {
    setBusy(true);
    try {
      const body = { name: form.name.trim(), mode: form.mode, provider: form.provider, titles: list(form.titles), states: list(form.states), keywords: list(form.keywords), offer: form.offer.trim(), sender_company: form.sender_company.trim(), persona: form.persona.trim() || undefined, signal_query: form.signal_query.trim() || undefined, meeting_minutes: Number(form.meeting_minutes), daily_cap: Number(form.daily_cap), active: form.active };
      if (editing) await api.updateCampaign(editing, body); else await api.createCampaign(body);
      toast(`Saved ${body.name} to the Campaigns tab.`); setEditing(null); setForm(empty); await camps.refresh();
    } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  }

  return <>
    <div className="guard"><b>A campaign is a saved search.</b> It says who to look for (titles, states, keywords), what you offer, and how many emails a day. Turning one on does not send anything by itself; drafts still wait in the Review queue.</div>
    <Err msg={camps.error} />
    <div className="card">
      {(camps.data ?? []).map((c) => <div key={c.name} className="camprow" style={{ borderBottom: "1px solid var(--line)" }}>
        <div><div className="n">{c.name}</div><div className="s">{c.mode === "CANDIDATE" ? "Candidates" : "Companies"} · row {c.rowNumber}</div></div>
        <div className="s">{c.status || "—"}</div>
        <div className="s">{c.active ? "On" : "Off"}</div>
        <button className="btn sm" onClick={() => { setEditing(c.name); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
        <Switch on={c.active} onChange={() => void toggle(c)} label={`${c.name} active`} />
      </div>)}
      {camps.data && !camps.data.length && <div className="empty">No campaigns in the Sheet yet.</div>}
      <div style={{ padding: 12 }}><button className="btn primary" onClick={() => { setEditing(""); setForm(empty); }}>New campaign</button></div>
    </div>
    {editing !== null && <div className="card" style={{ padding: 16 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>{editing ? `Edit ${editing}` : "New campaign"}</h3>
      <div className="form">
        <label>Name<input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="healthcare-ohio" /></label>
        <label>Looking for<select value={form.mode} onChange={(e) => set("mode", e.target.value as Form["mode"])}><option value="CORPORATE">Companies (decision makers)</option><option value="CANDIDATE">Candidates (people to hire)</option></select></label>
        <label>Where leads come from<select value={form.provider} onChange={(e) => set("provider", e.target.value)}><option value="gemini_xray">LinkedIn profile search (Gemini X-ray)</option><option value="job_search">LinkedIn hiring posts (job search)</option><option value="apify_or_apollo">Apify or Apollo</option><option value="csv_import">CSV file</option></select></label>
        <label>Sender company<input value={form.sender_company} onChange={(e) => set("sender_company", e.target.value)} /></label>
        <label className="wide">Titles (comma separated)<input value={form.titles} onChange={(e) => set("titles", e.target.value)} placeholder="CIO, VP IT, Director of Technology" /></label>
        <label>States<input value={form.states} onChange={(e) => set("states", e.target.value)} placeholder="Ohio, Indiana" /></label>
        <label>Keywords<input value={form.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="hospital, health system" /></label>
        <label className="wide">What you offer (one or two sentences; goes into every draft)<textarea rows={3} value={form.offer} onChange={(e) => set("offer", e.target.value)} /></label>
        <label className="wide">Who the email is from (persona, optional)<input value={form.persona} onChange={(e) => set("persona", e.target.value)} placeholder="Vikram, founder at One Smarter" /></label>
        {form.provider === "job_search" && <label className="wide">Hiring signal query (optional)<input value={form.signal_query} onChange={(e) => set("signal_query", e.target.value)} placeholder='"we are hiring" data engineer Ohio' /></label>}
        <label>Meeting length (minutes)<input type="number" min={5} value={form.meeting_minutes} onChange={(e) => set("meeting_minutes", Number(e.target.value))} /></label>
        <label>Daily send cap<input type="number" min={1} value={form.daily_cap} onChange={(e) => set("daily_cap", Number(e.target.value))} /></label>
        <label className="field" style={{ flexDirection: "row" }}><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Turn on after saving</label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn primary" disabled={busy} onClick={() => void save()}>Save to Sheet</button>
        <button className="btn" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</button>
      </div>
    </div>}
  </>;
}
