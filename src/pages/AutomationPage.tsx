import { useCallback, useEffect, useState } from "react";
import { api } from "../api/endpoints";
import type { Settings } from "../api/types";
import { Banner, Loading, Switch } from "../components/ui";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";

/** Labels for the Config tab keys AutoBooker reads (GET/PUT /api/settings). */
const LABEL: Record<string, string> = {
  DailySendCap: "Daily send cap", TimeZone: "Time zone", WorkStartHour: "First slot (hour)", WorkEndHour: "Last slot ends (hour)",
  MeetingMinutes: "Meeting length (min)", MeetingTitle: "Calendar title", SenderName: "Sender name", SenderTitle: "Sender title",
  SenderCompany: "Company", Street: "Street", CityStateZip: "City, state, zip", Phone: "Phone", OptOutLine: "Opt-out line",
};
const NUMBER_KEYS = new Set(["DailySendCap", "WorkStartHour", "WorkEndHour", "MeetingMinutes"]);
const HOURS = ["TimeZone", "WorkStartHour", "WorkEndHour", "MeetingMinutes", "MeetingTitle"];
const SIGNATURE = ["SenderName", "SenderTitle", "SenderCompany", "Street", "CityStateZip", "Phone", "OptOutLine"];

/** What runs without you, and the guard rails. Every value here is a cell in the Sheet's Config tab. */
export function AutomationPage() {
  const toast = useToast();
  const { refresh } = useData();
  const [settings, setSettings] = useState<Settings>();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.settings();
      setSettings(s);
      setDraft(s.values);
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error) return <Banner tone="bad">{error}</Banner>;
  if (!settings) return <Loading text="Reading the Config tab…" />;

  const values = settings.values;
  const live = (values.DryRun ?? "TRUE").toUpperCase() === "FALSE";
  const help = (k: string) => settings.fields.find((f) => f.key === k)?.help ?? "";

  const save = async (patch: Record<string, string>, message: string) => {
    // The same rules AutoBooker applies before it sends, checked here so a bad value never reaches the Sheet.
    const next = { ...values, ...patch };
    if ((next.DryRun ?? "TRUE").toUpperCase() === "FALSE") {
      const missing = ["SenderName", "Street", "CityStateZip"].filter((k) => !next[k]?.trim());
      if (missing.length) { toast(`Fill ${missing.map((k) => LABEL[k]).join(", ")} before turning on live sending.`, true); return; }
    }
    if (patch.OptOutLine !== undefined && !/unsubscribe/i.test(patch.OptOutLine)) { toast('The opt-out line must keep the word "unsubscribe" (CAN-SPAM).', true); return; }
    if (Number(next.WorkStartHour) >= Number(next.WorkEndHour)) { toast("The first slot must be earlier than the last slot.", true); return; }
    setBusy(true);
    try {
      const { values: saved } = await api.saveSettings(patch);
      setSettings({ ...settings, values: saved });
      setDraft(saved);
      toast(message);
      void refresh();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const changed = (keys: string[]) => Object.fromEntries(keys.filter((k) => (draft[k] ?? "") !== (values[k] ?? "")).map((k) => [k, draft[k] ?? ""]));
  const saveGroup = (keys: string[], message: string) => {
    const patch = changed(keys);
    if (!Object.keys(patch).length) { toast("Nothing changed"); return; }
    void save(patch, message);
  };
  const goLive = (on: boolean) => {
    if (on && !window.confirm(`Turn on live sending? Every row set to Approved will be emailed by AutoBooker, up to ${values.DailySendCap || 20} a day.`)) return;
    void save({ DryRun: on ? "FALSE" : "TRUE" }, on ? "Live sending is on" : "Dry run is on: nothing is sent");
  };
  const field = (k: string) => (
    <label className="field" key={k} title={help(k)}>
      {LABEL[k] ?? k}
      <input
        type={NUMBER_KEYS.has(k) ? "number" : "text"} value={draft[k] ?? ""}
        style={NUMBER_KEYS.has(k) ? { width: 80 } : { flex: 1, minWidth: 180 }}
        onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
      />
    </label>
  );

  return (
    <section className="view">
      <div className="guard">Automation moves work to the review queue and sends only what a person approved. <b>Nothing here sends an email without an Approved status.</b> These settings are the Sheet's Config tab, the same cells AutoBooker reads.</div>
      {!live && <Banner tone="warn">Dry run is on. AutoBooker writes what it would send to SendLog and the Notes column, and sends nothing.</Banner>}
      <div className="rules">
        <div className="card rule">
          <h3>Live sending<Switch on={live} label="Live sending" disabled={busy} onChange={goLive} /></h3>
          <p>Off means dry run. Turn it on after a dry run looks right and the signature is complete.</p>
          {field("DailySendCap")}
          <div><button className="btn sm" disabled={busy} onClick={() => saveGroup(["DailySendCap"], "Daily cap saved")}>Save</button></div>
        </div>
        <div className="card rule">
          <h3>Sending schedule</h3>
          <p>Two Apps Script timers do the work: <b>sendApproved</b> every 15 minutes sends Approved rows from Pipeline and Jobs_Pipeline, and <b>processReplies</b> every 10 minutes reads replies. Your computer can be off.</p>
        </div>
        <div className="card rule">
          <h3>Reply handling</h3>
          <p>AutoBooker offers three open times when asked, books when a time is named, marks opt-outs, and leaves anything unclear for a person.</p>
          {HOURS.map(field)}
          <div><button className="btn sm" disabled={busy} onClick={() => saveGroup(HOURS, "Working hours saved")}>Save</button></div>
        </div>
        <div className="card rule">
          <h3>Signature and opt-out</h3>
          <p>Added to every email at send time. The postal address and the word “unsubscribe” are required by CAN-SPAM.</p>
          {SIGNATURE.map(field)}
          <div><button className="btn sm" disabled={busy} onClick={() => saveGroup(SIGNATURE, "Signature saved")}>Save</button></div>
        </div>
        <div className="card rule">
          <h3>One email per person, ever</h3>
          <p>Before each run the engine reads Opted Out and Bounced rows from both pipelines. Anyone emailed before or who opted out is held back at gate 2, in every campaign and job search.</p>
        </div>
      </div>
    </section>
  );
}
