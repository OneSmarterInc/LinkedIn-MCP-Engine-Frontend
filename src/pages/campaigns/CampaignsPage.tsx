import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/endpoints";
import type { Campaign, CampaignSummary } from "../../api/types";
import { Banner, Loading, Switch } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { CampaignForm } from "./CampaignForm";

/** A campaign row from the Campaigns tab with its full settings (or the reason it cannot be read). */
export interface CampaignRow { summary: CampaignSummary; config?: Campaign; error?: string }

/** Same rows as the Campaigns tab. Edits here write to the Sheet and are validated by the engine before they save. */
export function CampaignsPage({ onCount }: { onCount: (n: number) => void }) {
  const toast = useToast();
  const [list, setList] = useState<CampaignRow[]>();
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<{ row?: CampaignRow }>();

  const load = useCallback(async () => {
    try {
      const { campaigns } = await api.campaigns();
      // The list holds names and status; each campaign's offer, states and titles come from GET /api/campaigns/:name.
      const rows = await Promise.all(campaigns.map(async (summary): Promise<CampaignRow> => {
        try { return { summary, config: await api.campaign(summary.name) }; }
        catch (e) { return { summary, error: (e as Error).message }; }
      }));
      setList(rows);
      onCount(rows.length);
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [onCount]);
  useEffect(() => { void load(); }, [load]);

  const toggle = async (row: CampaignRow, active: boolean) => {
    const { name } = row.summary;
    if (active && name.toLowerCase() === "jobs" &&
      !window.confirm('"Jobs" holds the offer for job-post emails. Turning it on also makes it a normal lead campaign. Turn it on anyway?')) return;
    try {
      await api.setActive(name, active);
      toast(`${name} ${active ? "active: runs on the next scheduled run" : "paused"}`);
      await load();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };

  if (!list && !error) return <Loading text="Reading the Campaigns tab…" />;

  return (
    <section className="view">
      {error && <Banner tone="bad">{error}</Banner>}
      <p className="hint">Same rows as the Campaigns tab. Edits here write to the Sheet and are validated by the engine before they save.</p>
      <div className="camp">
        {list?.length === 0 && <div className="card empty">No campaigns yet.</div>}
        {list?.map((row) => {
          const c = row.config;
          return (
            <div key={row.summary.name} className="card camprow">
              <div>
                <div className="n">{row.summary.name}</div>
                <div className="s">{c?.offer ?? <span style={{ color: "var(--bad)" }}>{row.error ?? row.summary.status}</span>}</div>
              </div>
              <div className="s"><span className="pill neutral">{row.summary.mode || "?"}</span> <span className="mono" style={{ fontSize: 12 }}>{c?.sourcing_provider}</span></div>
              <div className="s">{c?.target_geography.join(", ")}<br />{c?.decision_maker_titles.join(", ")}</div>
              <div className="s">Cap {c?.daily_send_cap ?? "?"}/day</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Switch on={row.summary.active} label={`${row.summary.name} active`} onChange={(v) => void toggle(row, v)} />
                <button className="btn sm" disabled={!c} onClick={() => setEditing({ row })}>Edit</button>
              </div>
            </div>
          );
        })}
      </div>
      <button className="btn" style={{ alignSelf: "flex-start" }} onClick={() => setEditing({})}>+ New campaign</button>
      {editing && (
        <CampaignForm
          original={editing.row}
          onClose={() => setEditing(undefined)}
          onSaved={async () => { setEditing(undefined); await load(); }}
        />
      )}
    </section>
  );
}
