/** Thin fetch wrapper. Every call goes to the backend; the browser never touches Google. */

export type PipelineRow = {
  tab: "Jobs_Pipeline" | "Pipeline"; row_number: number; company: string; domain: string; name: string; title: string; email: string;
  research: string; status: string; subject: string; body: string; thread_id: string;
  signal?: { role: string; posted?: string; url?: string };
};
export type LeftOutRow = { tab: string; company: string; name: string; title: string; email: string; location: string; failed_gate: string; reason: string; why: string; campaign: string };
export type Summary = { by_status: Record<string, number>; quarantined: number; by_reason: Record<string, number> };
export type CampaignSummary = { name: string; active: boolean; mode: string; status: string; rowNumber: number };
export type Campaign = {
  campaign_name: string; mode: "CORPORATE" | "CANDIDATE"; sourcing_provider: string; target_geography: string[]; decision_maker_titles: string[];
  industry_keywords: string[]; offer?: string; sender_company?: string; outreach_persona?: string; calendar_duration_minutes: number; daily_send_cap: number;
};
export type SearchRecord = {
  search_id: string; status: "RUNNING" | "DONE" | "FAILED"; started_at: string; updated_at: string; error?: string;
  progress?: { stage: string; message: string; searches_done: number; searches_max: number; jobs_found: number; with_email: number; lookups_used: number };
  jobs_so_far?: Array<{ job_title: string; company: string; location: string; email: string | null; email_source: string; contact_name?: string }>;
  log: string[];
  result?: { total: number; with_email: number; searches: number; seamless_lookups_used: number; outreach?: { passed?: number; drafted?: number; exported?: number }; outreach_error?: string; jobs: Array<{ job_title: string; company: string; location: string; email: string | null; email_source: string; contact_name?: string; url: string; posted_date_unconfirmed: string | null }> };
};
export type RunView = {
  run_id: string; status: string; message?: string; error?: string; campaign: string; created_at: string; updated_at: string;
  counts: { sourced: number; passed?: number; failed?: number; drafted?: number };
  leads: Array<{ name: string; title: string; company: string; email?: string; email_source?: string; result: string; email_subject?: string }>;
};
export type RunSummary = { run_id: string; status: string; campaign: string; leads: number; passed?: number; drafts?: number; created_at: string };
export type Settings = { values: Record<string, string>; fields: Array<{ key: string; default: string; help: string }> };

const TOKEN_KEY = "outreach-api-token";
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; } };
export const setToken = (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } };

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const t = getToken(); if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data: unknown = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  return data as T;
}

export const api = {
  health: () => call<{ ok: boolean; sheet: boolean; auth: boolean }>("GET", "/api/health"),
  pipeline: (tab: "all" | "Jobs_Pipeline" | "Pipeline" = "all", fresh = false) => call<{ rows: PipelineRow[] }>("GET", `/api/pipeline?tab=${tab}${fresh ? "&fresh=1" : ""}`),
  leftOut: () => call<{ rows: LeftOutRow[] }>("GET", "/api/pipeline/left-out"),
  summary: () => call<Summary>("GET", "/api/pipeline/summary"),
  approve: (email: string) => call<PipelineRow>("POST", `/api/pipeline/${encodeURIComponent(email)}/approve`),
  reject: (email: string) => call<PipelineRow>("POST", `/api/pipeline/${encodeURIComponent(email)}/reject`),
  reopen: (email: string) => call<PipelineRow>("POST", `/api/pipeline/${encodeURIComponent(email)}/reopen`),
  saveDraft: (email: string, patch: { subject?: string; body?: string }) => call<PipelineRow>("PATCH", `/api/pipeline/${encodeURIComponent(email)}/draft`, patch),
  startSearch: () => call<{ search_id: string; campaign: string }>("POST", "/api/search"),
  searches: () => call<{ searches: Array<{ search_id: string; status: string; started_at: string; total?: number; with_email?: number; drafts?: number }>; defaults: { daysBack: number; maxJobs: number; maxSearches: number; maxSeamlessLookups: number } }>("GET", "/api/search"),
  search: (id: string) => call<SearchRecord>("GET", `/api/search/${id}`),
  startRun: (campaign: string, limit: number) => call<{ run_id: string; campaign: string }>("POST", "/api/runs", { campaign, limit, export: true }),
  runs: () => call<{ runs: RunSummary[] }>("GET", "/api/runs"),
  run: (id: string) => call<RunView>("GET", `/api/runs/${id}`),
  campaigns: () => call<{ campaigns: CampaignSummary[] }>("GET", "/api/campaigns"),
  campaign: (name: string) => call<Campaign>("GET", `/api/campaigns/${encodeURIComponent(name)}`),
  createCampaign: (c: Record<string, unknown>) => call<CampaignSummary>("POST", "/api/campaigns", c),
  updateCampaign: (name: string, c: Record<string, unknown>) => call<CampaignSummary>("PATCH", `/api/campaigns/${encodeURIComponent(name)}`, c),
  setActive: (name: string, active: boolean) => call<{ name: string; active: boolean }>("POST", `/api/campaigns/${encodeURIComponent(name)}/active`, { active }),
  settings: () => call<Settings>("GET", "/api/settings"),
  saveSettings: (patch: Record<string, string | number | boolean>) => call<{ values: Record<string, string> }>("PUT", "/api/settings", patch),
};

export const ageHours = (iso?: string) => iso ? Math.round((Date.now() - new Date(iso).getTime()) / 3600e3) : undefined;
export const ageText = (iso?: string) => { const h = ageHours(iso); if (h === undefined || Number.isNaN(h)) return ""; return h < 1 ? "just now" : h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`; };
export const statusKind = (s: string) =>
  s === "Ready for Review" || s === "Needs Rewrite" ? "info" : s === "Approved" || s === "Sending" ? "warn"
  : s === "Sent" || s === "Replied" || s === "Meeting Booked" ? "ok" : s === "Rejected" || s === "Opted Out" || s === "Bounced" || s === "Send Error" ? "bad" : "neutral";
