import { request } from "./client";
import type {
  Campaign, CampaignBody, CampaignSummary, Health, LeftOutRow, PipelineRow, RunSummary, RunView,
  SearchDefaults, SearchListItem, SearchRecord, Settings, Summary,
} from "./types";

/**
 * One function per backend route, in the same order as src/api/app.ts in the backend.
 * Pages call these; nothing else in the app builds a URL.
 */

const e = encodeURIComponent;

export const api = {
  // ---- health ----
  health: () => request<Health>("GET", "/api/health"),

  // ---- pipeline rows (Jobs_Pipeline + Pipeline) ----
  pipeline: (tab: "all" | "Jobs_Pipeline" | "Pipeline" = "all", fresh = false) =>
    request<{ rows: PipelineRow[] }>("GET", `/api/pipeline?tab=${tab}${fresh ? "&fresh=true" : ""}`),
  leftOut: () => request<{ rows: LeftOutRow[] }>("GET", "/api/pipeline/left-out"),
  summary: () => request<Summary>("GET", "/api/pipeline/summary"),
  row: (email: string) => request<PipelineRow>("GET", `/api/pipeline/${e(email)}`),
  approve: (email: string) => request<PipelineRow>("POST", `/api/pipeline/${e(email)}/approve`),
  reject: (email: string) => request<PipelineRow>("POST", `/api/pipeline/${e(email)}/reject`),
  reopen: (email: string) => request<PipelineRow>("POST", `/api/pipeline/${e(email)}/reopen`),
  saveDraft: (email: string, patch: { subject?: string; body?: string }) =>
    request<PipelineRow>("PATCH", `/api/pipeline/${e(email)}/draft`, patch),

  // ---- job search ----
  startSearch: () => request<{ search_id: string; campaign: string }>("POST", "/api/search"),
  searches: (limit = 10) => request<{ searches: SearchListItem[]; defaults: SearchDefaults }>("GET", `/api/search?limit=${limit}`),
  latestSearch: () => request<SearchRecord>("GET", "/api/search/latest"),
  search: (id: string) => request<SearchRecord>("GET", `/api/search/${e(id)}`),

  // ---- campaign runs ----
  startRun: (campaign: string, limit: number) =>
    request<{ run_id: string; campaign: string }>("POST", "/api/runs", { campaign, limit, export: true }),
  runs: (limit = 10) => request<{ runs: RunSummary[] }>("GET", `/api/runs?limit=${limit}`),
  run: (id: string) => request<RunView>("GET", `/api/runs/${e(id)}`),

  // ---- campaigns (the Campaigns tab) ----
  campaigns: () => request<{ campaigns: CampaignSummary[] }>("GET", "/api/campaigns"),
  campaign: (name: string) => request<Campaign>("GET", `/api/campaigns/${e(name)}`),
  createCampaign: (body: CampaignBody) => request<CampaignSummary>("POST", "/api/campaigns", body),
  updateCampaign: (name: string, body: Partial<CampaignBody>) => request<CampaignSummary>("PATCH", `/api/campaigns/${e(name)}`, body),
  setActive: (name: string, active: boolean) => request<{ name: string; active: boolean }>("POST", `/api/campaigns/${e(name)}/active`, { active }),
  validateCampaigns: () => request<{ campaigns: CampaignSummary[] }>("POST", "/api/campaigns/validate"),

  // ---- settings (the Config tab AutoBooker reads) ----
  settings: () => request<Settings>("GET", "/api/settings"),
  saveSettings: (patch: Record<string, string | number | boolean>) => request<{ values: Record<string, string> }>("PUT", "/api/settings", patch),
};
