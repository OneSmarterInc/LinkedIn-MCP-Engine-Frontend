import { useEffect, useState } from "react";
import { api } from "../api/endpoints";
import type { JobView, LeadView, LeftOutRow, PipelineRow, RunView, SearchRecord } from "../api/types";
import { useData } from "../context/DataContext";
import { ageText, whenText } from "../utils/format";
import type { DrawerItem } from "./Drawer";
import { Banner, Loading, Modal, Pill, StatusPill } from "./ui";

/** Which run to show: a job search (GET /api/search/:id) or a campaign run (GET /api/runs/:id). */
export type RunTarget = { kind: "search"; id: string } | { kind: "run"; id: string };

const EMAIL_SOURCE: Record<string, string> = {
  seamless_poster: "Seamless, the person who posted",
  seamless_recruiter: "Seamless, a recruiter or HR person",
  not_found: "Seamless found no one",
  lookup_limit: "Not looked up: the Seamless limit for this run was reached",
  seamless_off: "Not looked up: Seamless is off",
};

const DRAFT: Record<string, [label: string, tone: "ok" | "warn" | "bad"]> = {
  READY: ["Ready", "ok"], NEEDS_REWRITE: ["Needs rewrite", "warn"], DRAFT_ERROR: ["Draft failed", "bad"],
};

const same = (a?: string | null, b?: string | null) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

/**
 * Everything one run found, and what happened to each item: drafted (with its Sheet status), held back (with the
 * reason), or not written. Rows that are in the Sheet open in the review drawer.
 */
export function RunDetails({ target, onClose, onOpen }: { target: RunTarget; onClose: () => void; onOpen: (item: DrawerItem) => void }) {
  const [search, setSearch] = useState<SearchRecord>();
  const [run, setRun] = useState<RunView>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const load = target.kind === "search" ? api.search(target.id).then(setSearch) : api.run(target.id).then(setRun);
    load.catch((e: Error) => setError(e.message));
  }, [target]);

  const title = target.kind === "search" ? "Job search details" : `Campaign run details${run ? `: ${run.campaign}` : ""}`;
  return (
    <Modal wide title={title} onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      {error && <Banner tone="bad">{error}</Banner>}
      {!error && !search && !run && <Loading text="Reading the run…" />}
      {search && <SearchDetails record={search} onOpen={onOpen} />}
      {run && <CampaignRunDetails run={run} onOpen={onOpen} />}
    </Modal>
  );
}

function SearchDetails({ record, onOpen }: { record: SearchRecord; onOpen: (item: DrawerItem) => void }) {
  const { rows, leftOut } = useData();
  const r = record.result;
  const jobs: JobView[] = r?.jobs ?? record.jobs_so_far ?? [];
  const o = r?.outreach;

  const outcome = (job: JobView): { row?: PipelineRow; held?: LeftOutRow } => {
    const row = job.email ? rows.find((x) => x.tab === "Jobs_Pipeline" && same(x.email, job.email)) : undefined;
    if (row) return { row };
    const held = leftOut.find((x) => x.tab === "Jobs_Quarantine" && x.run_id === record.search_id
      && (job.email ? same(x.email, job.email) : same(x.company, job.company)));
    return { held };
  };

  return (
    <>
      <div className="details-stats">
        <span>Started <b>{whenText(record.started_at)}</b></span>
        <span>Status <b>{record.status}</b></span>
        {r && <span>Jobs kept <b>{r.total}</b></span>}
        {r && <span>With email <b>{r.with_email}</b></span>}
        {r && <span>Seamless credits <b>{r.seamless_lookups_used}</b></span>}
        {o && <span>Drafts written to Jobs_Pipeline <b>{o.pipeline_added}</b></span>}
        {o && <span>Held back <b>{o.quarantined_added}</b></span>}
        {o?.pipeline_already_present ? <span>Already in the Sheet <b>{o.pipeline_already_present}</b></span> : null}
      </div>
      {record.error && <Banner tone="bad">{record.error}</Banner>}
      {r?.outreach_error && <Banner tone="bad">Writing to the Sheet failed: {r.outreach_error}</Banner>}
      <div className="tablewrap"><table>
        <thead><tr><th>Posted</th><th>Role they are hiring</th><th>Company</th><th>Contact</th><th>Email</th><th>What happened</th><th /></tr></thead>
        <tbody>
          {jobs.length === 0 && <tr><td colSpan={7} className="empty">This search kept no jobs.</td></tr>}
          {jobs.map((job, i) => {
            const { row, held } = outcome(job);
            const open = row ? () => onOpen({ kind: "row", row }) : held ? () => onOpen({ kind: "left-out", row: held }) : undefined;
            return (
              <tr key={`${job.url}:${i}`} className={open ? "row" : ""} onClick={open} title={open ? "Open in the review panel" : undefined}>
                <td><span className="age">{ageText(job.posted_date_unconfirmed)}</span></td>
                <td><div className="t">{job.job_title}</div><div className="s">{job.location}</div></td>
                <td><div className="t">{job.company}</div><div className="s">{job.company_domain}</div></td>
                <td>{job.contact_name ? <><div className="t">{job.contact_name}</div><div className="s">{job.contact_title}</div></> : <span className="s">Not identified</span>}</td>
                <td>
                  {job.email ? <div className="s mono" style={{ fontSize: 12 }}>{job.email}</div> : <Pill tone="bad">None</Pill>}
                  <div className="s">{EMAIL_SOURCE[job.email_source] ?? job.email_source}</div>
                </td>
                <td>
                  {row && <><StatusPill status={row.status} /><div className="s">{row.subject}</div></>}
                  {!row && held && <><Pill tone="bad">{held.failed_gate ? `Held back at gate ${held.failed_gate}` : "Held back"}</Pill><div className="s">{held.why}</div></>}
                  {!row && !held && <><Pill>Not in the Sheet</Pill><div className="s">{job.email ? "Not written by this run" : "No email, so no draft"}</div></>}
                </td>
                <td onClick={(e) => e.stopPropagation()}>{job.url && <a href={job.url} target="_blank" rel="noopener noreferrer">Open post</a>}</td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </>
  );
}

function CampaignRunDetails({ run, onOpen }: { run: RunView; onOpen: (item: DrawerItem) => void }) {
  const { rows, leftOut } = useData();
  const leads: LeadView[] = run.leads ?? [];

  const gate = (lead: LeadView, held?: LeftOutRow) => {
    if (lead.result === "PASSED") return <Pill tone="ok">Passed</Pill>;
    if (lead.result.startsWith("FAILED")) return <><Pill tone="bad">{held?.failed_gate ? `Held back at gate ${held.failed_gate}` : "Held back"}</Pill><div className="s">{held?.why ?? lead.result}</div></>;
    return <Pill>Not checked yet</Pill>;
  };

  return (
    <>
      <div className="details-stats">
        <span>Started <b>{whenText(run.created_at)}</b></span>
        <span>Status <b>{run.status}</b></span>
        <span>Found <b>{run.counts.sourced}</b></span>
        {run.counts.passed !== undefined && <span>Passed gates <b>{run.counts.passed}</b></span>}
        {run.counts.failed !== undefined && <span>Held back <b>{run.counts.failed}</b></span>}
        {run.counts.drafted !== undefined && <span>Drafted <b>{run.counts.drafted}</b></span>}
      </div>
      {run.error && <Banner tone="bad">{run.error}</Banner>}
      {run.status === "VERIFIED" && <Banner tone="warn">This run stopped after the gates. Nothing was drafted or written to the Sheet.</Banner>}
      <div className="tablewrap"><table>
        <thead><tr><th>Person</th><th>Company</th><th>Email</th><th>Gates</th><th>Draft</th><th>In the Sheet</th></tr></thead>
        <tbody>
          {leads.length === 0 && <tr><td colSpan={6} className="empty">This run found no leads.</td></tr>}
          {leads.map((lead) => {
            const row = lead.email ? rows.find((x) => x.tab === "Pipeline" && same(x.email, lead.email)) : undefined;
            const held = leftOut.find((x) => x.run_id === run.run_id && (lead.email ? same(x.email, lead.email) : same(x.company, lead.company) && same(x.name, lead.name)));
            const open = row ? () => onOpen({ kind: "row", row }) : held ? () => onOpen({ kind: "left-out", row: held }) : undefined;
            return (
              <tr key={lead.lead_id} className={open ? "row" : ""} onClick={open} title={open ? "Open in the review panel" : undefined}>
                <td><div className="t">{lead.name}</div><div className="s">{lead.title}</div></td>
                <td><div className="t">{lead.company}</div><div className="s">{lead.location}</div></td>
                <td>{lead.email ? <div className="s mono" style={{ fontSize: 12 }}>{lead.email}</div> : <Pill tone="bad">None</Pill>}</td>
                <td>{gate(lead, held)}</td>
                <td>{lead.draft_status ? <><Pill tone={DRAFT[lead.draft_status]?.[1] ?? "warn"}>{DRAFT[lead.draft_status]?.[0] ?? lead.draft_status}</Pill><div className="s">{lead.email_subject || lead.draft_issues?.[0]}</div></> : <span className="s">-</span>}</td>
                <td>{row ? <StatusPill status={row.status} /> : held ? <span className="s">In the held-back tab</span> : <span className="s">Not written</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </>
  );
}
