// Response shapes of the backend API (LinkedIn-MCP-Engine-Backend/src/api).
// Each type names the backend file it mirrors. Change both together.

export type PipelineTab = "Jobs_Pipeline" | "Pipeline";

/** src/api/services/sheet-rows.ts → PipelineRow */
export interface PipelineRow {
  tab: PipelineTab;
  row_number: number;
  company: string;
  domain: string;
  name: string;
  title: string;
  email: string;
  research: string;
  status: string;
  subject: string;
  body: string;
  thread_id: string;
  /** Parsed from the Research cell when the row came from a job post. */
  signal?: { role: string; posted?: string; url?: string };
}

/** src/api/services/sheet-rows.ts → QuarantineRow ("left out") */
export interface LeftOutRow {
  tab: string;
  row_number: number;
  company: string;
  domain: string;
  name: string;
  title: string;
  email: string;
  location: string;
  failed_gate: string;
  reason: string;
  campaign: string;
  run_id: string;
  /** The reason in plain words. */
  why: string;
}

/** GET /api/pipeline/summary */
export interface Summary {
  by_status: Record<string, number>;
  quarantined: number;
  by_reason: Record<string, number>;
}

/** GET /api/health */
export interface Health { ok: boolean; sheet: boolean; auth: boolean }

/** src/core/jobs/job-search.ts → JobView */
export interface JobView {
  job_title: string;
  company: string;
  company_domain?: string;
  location: string;
  posted_date_unconfirmed: string | null;
  description: string;
  url: string;
  email: string | null;
  email_source: "seamless_poster" | "seamless_recruiter" | "not_found" | "lookup_limit" | "seamless_off";
  contact_name?: string;
  contact_title?: string;
}

export type SearchStage = "starting" | "searching" | "emails" | "syncing" | "verifying" | "drafting" | "exporting" | "done";

/** src/core/jobs/job-search.ts → JobSearchRecord (GET /api/search/:id) */
export interface SearchRecord {
  search_id: string;
  status: "RUNNING" | "DONE" | "FAILED";
  started_at: string;
  updated_at: string;
  error?: string;
  progress?: {
    stage: SearchStage; message: string; searches_done: number; searches_max: number;
    jobs_found: number; with_email: number; lookups_used: number;
  };
  jobs_so_far?: JobView[];
  log: string[];
  result?: {
    searched_at: string;
    searches: number;
    total: number;
    with_email: number;
    seamless_lookups_used: number;
    jobs: JobView[];
    outreach?: {
      contacts: number; passed: number; quarantined: number; drafts_ready: number;
      pipeline_added: number; quarantined_added: number;
      pipeline_already_present?: number; drafts_need_rewrite?: number; draft_errors?: number;
    };
    outreach_error?: string;
  };
}

/** GET /api/search → one item in "searches" */
export interface SearchListItem {
  search_id: string;
  status: "RUNNING" | "DONE" | "FAILED";
  started_at: string;
  updated_at: string;
  total?: number;
  with_email?: number;
  drafts?: number;
}

export interface SearchDefaults { daysBack: number; maxJobs: number; maxSearches: number; maxSeamlessLookups: number }

/** src/mcp/run-store.ts → McpRunSummary (GET /api/runs) */
export interface RunSummary {
  run_id: string;
  status: string;
  campaign: string;
  leads: number;
  passed?: number;
  drafts?: number;
  created_at: string;
  updated_at: string;
}

/** src/mcp/run-view.ts → RunView (GET /api/runs/:id) */
export interface RunView {
  run_id: string;
  status: string;
  campaign: string;
  provider?: string;
  message?: string;
  error?: string;
  created_at: string;
  updated_at: string;
  counts: { sourced: number; with_email?: number; passed?: number; failed?: number; drafted?: number };
  /** One entry per lead found, with what happened to it. */
  leads?: LeadView[];
}

/** src/mcp/run-view.ts → LeadView */
export interface LeadView {
  lead_id: string;
  name: string;
  title: string;
  company: string;
  company_domain?: string;
  location: string;
  linkedin_url?: string;
  email?: string;
  email_source?: string;
  /** PASSED, NOT VERIFIED YET, or "FAILED gate 3: DOMAIN_MISMATCH". */
  result: string;
  draft_status?: string;
  email_subject?: string;
  draft_issues?: string[];
}

/** src/config/store.ts → CampaignSummary (GET /api/campaigns) */
export interface CampaignSummary { name: string; active: boolean; mode: string; status: string; rowNumber: number }

/** src/config/schema.ts → CampaignConfig (GET /api/campaigns/:name) */
export interface Campaign {
  campaign_name: string;
  mode: "CORPORATE" | "CANDIDATE";
  sourcing_provider: string;
  target_geography: string[];
  decision_maker_titles: string[];
  industry_keywords: string[];
  signal_query?: string;
  outreach_persona?: string;
  sender_company?: string;
  offer?: string;
  calendar_duration_minutes: number;
  daily_send_cap: number;
}

/** Body of POST /api/campaigns and PATCH /api/campaigns/:name */
export interface CampaignBody {
  name: string;
  mode: "CORPORATE" | "CANDIDATE";
  provider: "gemini_xray" | "csv_import";
  titles: string[];
  states: string[];
  keywords: string[];
  offer: string;
  sender_company: string;
  persona?: string;
  signal_query?: string;
  meeting_minutes: number;
  daily_cap: number;
  active: boolean;
}

/** GET /api/settings */
export interface Settings {
  values: Record<string, string>;
  fields: { key: string; default: string; help: string }[];
}
