import { useEffect, useState } from "react";
import { api } from "../api";
import { Err, Switch, usePoll, useToast } from "../components/ui";

/** Automation: the Config tab AutoBooker reads. Same cells, plainer words. */
export function AutomationPage() {
  const toast = useToast();
  const s = usePoll(() => api.settings(), 60_000, false);
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (s.data) setV(s.data.values); }, [s.data]);
  const dirty = s.data ? Object.keys(v).some((k) => v[k] !== s.data!.values[k]) : false;
  const set = (k: string, val: string) => setV((x) => ({ ...x, [k]: val }));
  const live = (v.DryRun ?? "TRUE").toUpperCase() !== "TRUE";

  async function save(patch?: Record<string, string>) {
    setBusy(true);
    try {
      const p = patch ?? Object.fromEntries(Object.entries(v).filter(([k, val]) => val !== s.data?.values[k]));
      const r = await api.saveSettings(p); s.setData({ values: r.values, fields: s.data?.fields ?? [] }); setV(r.values); toast("Saved to the Config tab. AutoBooker uses it on its next cycle.");
    } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  }
  const help = (k: string) => s.data?.fields.find((f) => f.key === k)?.help ?? "";
  const num = (k: string, label: string, min = 0) => <label className="field">{label}<input type="number" min={min} value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)} style={{ width: 90 }} /><span className="hint">{help(k)}</span></label>;
  const txt = (k: string, label: string, wide = false) => <label className={wide ? "wide" : ""}>{label}<input value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)} /><span className="hint">{help(k)}</span></label>;

  return <>
    <div className="guard"><b>Two Apps Script timers do the sending.</b> Every 15 minutes AutoBooker sends Approved rows; every 10 minutes it reads replies, offers times and books the call. These settings are the Config tab of the Sheet; changing them here changes the tab.</div>
    <Err msg={s.error} />
    {s.data && <>
      <div className="rules">
        <div className="card rule">
          <h3>Live sending <Switch on={live} onChange={(on) => void save({ DryRun: on ? "FALSE" : "TRUE" })} label="Live sending" /></h3>
          <p>{live ? "On. Approved emails really go out." : "Off (dry run). AutoBooker logs what it would send and sends nothing. Turn on when the signature below is filled in."}</p>
        </div>
        <div className="card rule">
          <h3>Daily limit</h3>
          {num("DailySendCap", "First emails per day", 1)}
          {num("MeetingMinutes", "Meeting length (min)", 5)}
        </div>
        <div className="card rule">
          <h3>Working hours (times offered to people who reply)</h3>
          {num("WorkStartHour", "Start hour (24 h)", 0)}
          {num("WorkEndHour", "End hour (24 h)", 1)}
          <label className="field">Time zone<input value={v.TimeZone ?? ""} onChange={(e) => set("TimeZone", e.target.value)} style={{ width: 200 }} /></label>
        </div>
      </div>
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>Signature and legal footer (required before live sending)</h3>
        <div className="form">
          {txt("SenderName", "Your name")}{txt("SenderTitle", "Your title")}{txt("SenderCompany", "Company")}{txt("Phone", "Phone (optional)")}
          {txt("Street", "Street address")}{txt("CityStateZip", "City, state, zip")}
          {txt("OptOutLine", "Opt-out line", true)}{txt("MeetingTitle", "Calendar event title", true)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn primary" disabled={!dirty || busy} onClick={() => void save()}>Save changes</button>
        {dirty && <button className="btn" onClick={() => setV(s.data!.values)}>Discard</button>}
      </div>
    </>}
  </>;
}
