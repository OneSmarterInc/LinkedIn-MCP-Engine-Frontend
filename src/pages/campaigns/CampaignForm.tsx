import { useState } from "react";
import { api } from "../../api/endpoints";
import { PROVIDERS, type CampaignBody, type Provider } from "../../api/types";
import { Banner, Modal, Switch } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import type { CampaignRow } from "./CampaignsPage";

const split = (s: string) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

const PROVIDER_LABELS: Record<Provider, string> = {
  gemini_xray: "LinkedIn profile search (gemini_xray)",
  job_search: "LinkedIn job posts (job_search)",
  csv_import: "A CSV file (csv_import)",
  apify_or_apollo: "Apify or Apollo (apify_or_apollo)",
};
const isProvider = (v: unknown): v is Provider => (PROVIDERS as readonly string[]).includes(String(v));

function initial(row?: CampaignRow): CampaignBody {
  const c = row?.config;
  return {
    name: row?.summary.name ?? "",
    mode: c?.mode ?? "CORPORATE",
    // Show the stored provider as it is, so editing another field never changes it.
    provider: isProvider(c?.sourcing_provider) ? c.sourcing_provider : "gemini_xray",
    titles: c?.decision_maker_titles ?? [],
    states: c?.target_geography ?? [],
    keywords: c?.industry_keywords ?? [],
    offer: c?.offer ?? "",
    sender_company: c?.sender_company ?? "One Smarter",
    persona: c?.outreach_persona ?? "",
    signal_query: c?.signal_query ?? "",
    meeting_minutes: c?.calendar_duration_minutes ?? 15,
    daily_cap: c?.daily_send_cap ?? 20,
    active: row?.summary.active ?? false,
  };
}

/** Create a campaign (POST /api/campaigns) or edit one (PATCH /api/campaigns/:name). */
export function CampaignForm({ original, onClose, onSaved }: { original?: CampaignRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<CampaignBody>(() => initial(original));
  const [lists, setLists] = useState(() => ({ titles: form.titles.join(", "), states: form.states.join(", "), keywords: form.keywords.join(", ") }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const set = <K extends keyof CampaignBody>(k: K, v: CampaignBody[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    // On edit, an emptied box is sent as "" so the backend clears the cell (undefined would mean "leave it").
    // On create, an empty box is left out so the backend applies its defaults.
    const text = (v?: string) => { const t = v?.trim() ?? ""; return t || (original ? "" : undefined); };
    const body: CampaignBody = {
      ...form,
      name: form.name.trim(),
      titles: split(lists.titles),
      states: split(lists.states),
      keywords: split(lists.keywords),
      persona: text(form.persona),
      signal_query: text(form.signal_query),
    };
    setBusy(true);
    setError(undefined);
    try {
      if (original) await api.updateCampaign(original.summary.name, body);
      else await api.createCampaign(body);
      toast(`${body.name} saved to the Campaigns tab`);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={original ? `Edit ${original.summary.name}` : "New campaign"}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button></>}
    >
      {error && <Banner tone="bad">{error}</Banner>}
      <div className="form">
        <label htmlFor="c-name">Name</label>
        <input id="c-name" value={form.name} disabled={Boolean(original)} onChange={(e) => set("name", e.target.value)} />
        <label htmlFor="c-mode">Mode</label>
        <select id="c-mode" value={form.mode} onChange={(e) => set("mode", e.target.value as CampaignBody["mode"])}>
          <option value="CORPORATE">CORPORATE: people at companies</option>
          <option value="CANDIDATE">CANDIDATE: job seekers</option>
        </select>
        <label htmlFor="c-provider">Find leads with</label>
        <select id="c-provider" value={form.provider} onChange={(e) => set("provider", e.target.value as Provider)}>
          {PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>)}
        </select>
        <label htmlFor="c-titles">Titles</label>
        <input id="c-titles" value={lists.titles} placeholder="CFO, VP Human Resources" onChange={(e) => setLists({ ...lists, titles: e.target.value })} />
        <span className="help">Who receives the email. Separate with commas.</span>
        <label htmlFor="c-states">States</label>
        <input id="c-states" value={lists.states} placeholder="Ohio, Indiana" onChange={(e) => setLists({ ...lists, states: e.target.value })} />
        <label htmlFor="c-keywords">Keywords</label>
        <input id="c-keywords" value={lists.keywords} placeholder="self-funded, manufacturing" onChange={(e) => setLists({ ...lists, keywords: e.target.value })} />
        <span className="help">Optional. Narrows the search to kinds of companies.</span>
        <label htmlFor="c-offer">Offer</label>
        <textarea id="c-offer" value={form.offer} placeholder="a 15-minute call about developers we can place for the role you posted" onChange={(e) => set("offer", e.target.value)} />
        <span className="help">One sentence (at least 10 characters). The only thing the email may offer.</span>
        <label htmlFor="c-sender">Sender company</label>
        <input id="c-sender" value={form.sender_company} onChange={(e) => set("sender_company", e.target.value)} />
        <label htmlFor="c-persona">Persona</label>
        <input id="c-persona" value={form.persona ?? ""} placeholder="the COO of a staffing company" onChange={(e) => set("persona", e.target.value)} />
        <label htmlFor="c-minutes">Meeting minutes</label>
        <input id="c-minutes" type="number" min={5} max={120} value={form.meeting_minutes} onChange={(e) => set("meeting_minutes", Number(e.target.value))} />
        <label htmlFor="c-cap">Daily cap</label>
        <input id="c-cap" type="number" min={1} max={500} value={form.daily_cap} onChange={(e) => set("daily_cap", Number(e.target.value))} />
        <label>Active</label>
        <div><Switch on={form.active} label="Active" onChange={(v) => set("active", v)} /> <span className="hint">Active campaigns run on the scheduled runs.</span></div>
      </div>
    </Modal>
  );
}
