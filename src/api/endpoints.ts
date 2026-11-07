import { request } from "./client";
import type {
  AuditRow, AuthUser, Campaign, CampaignBody, CampaignDetail, CampaignSummary, Health, LeftOutRow, LoginNext, Me, PipelineRow, Role, RunSummary, RunView,
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

  // ---- accounts ----
  me: () => request<Me>("GET", "/api/auth/me"),
  register: (b: { full_name: string; email: string; password: string; confirm: string }) => request<{ status: "pending" | "active" }>("POST", "/api/auth/register", b),
  login: (b: { email: string; password: string }) => request<LoginNext>("POST", "/api/auth/login", b),
  enroll2fa: (code: string) => request<{ user: AuthUser; recovery_codes: string[] }>("POST", "/api/auth/2fa/enroll", { code }),
  verify2fa: (code: string) => request<{ user: AuthUser; recovery_codes_left: number }>("POST", "/api/auth/2fa/verify", { code }),
  logout: () => request<{ ok: true }>("POST", "/api/auth/logout", {}),
  forgot: (email: string) => request<{ ok: true; message: string }>("POST", "/api/auth/forgot", { email }),
  resetPassword: (b: { token: string; password: string; confirm: string }) => request<{ ok: true }>("POST", "/api/auth/reset", b),
  testMail: () => request<{ ok: true; to: string; from: string }>("POST", "/api/auth/test-mail", {}),
  users: () => request<{ users: AuthUser[]; pending: number }>("GET", "/api/users"),
  approveUser: (id: string, role: Role) => request<{ user: AuthUser }>("POST", `/api/users/${id}/approve`, { role }),
  rejectUser: (id: string, reason?: string) => request<{ ok: true }>("POST", `/api/users/${id}/reject`, { reason }),
  disableUser: (id: string) => request<{ user: AuthUser }>("POST", `/api/users/${id}/disable`, {}),
  enableUser: (id: string) => request<{ user: AuthUser }>("POST", `/api/users/${id}/enable`, {}),
  resetTwoFactor: (id: string) => request<{ user: AuthUser }>("POST", `/api/users/${id}/reset-2fa`, {}),
  setRole: (id: string, role: Role) => request<{ user: AuthUser }>("POST", `/api/users/${id}/role`, { role }),
  audit: (limit = 100) => request<{ rows: AuditRow[] }>("GET", `/api/audit?limit=${limit}`),

  // ---- pipeline rows (Jobs_Pipeline + Pipeline) ----
  pipeline: (tab: "all" | "Jobs_Pipeline" | "Pipeline" = "all", fresh = false) =>
    request<{ rows: PipelineRow[] }>("GET", `/api/pipeline?tab=${tab}${fresh ? "&fresh=true" : ""}`),
  leftOut: () => request<{ rows: LeftOutRow[] }>("GET", "/api/pipeline/left-out"),
  summary: () => request<Summary>("GET", "/api/pipeline/summary"),
  row: (email: string) => request<PipelineRow>("GET", `/api/pipeline/${e(email)}`),
  approve: (email: string) => request<PipelineRow>("POST", `/api/pipeline/${e(email)}/approve`),
  reject: (email: string) => request<PipelineRow>("POST", `/api/pipeline/${e(email)}/reject`),
  reopen: (email: string) => request<PipelineRow>("POST", `/api/pipeline/${e(email)}/reopen`),
  meetingBooked: (email: string) => request<PipelineRow>("POST", `/api/pipeline/${e(email)}/outcome`, { outcome: "meeting_booked" }),
  notInterested: (email: string) => request<PipelineRow>("POST", `/api/pipeline/${e(email)}/outcome`, { outcome: "not_interested" }),
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
  campaigns: () => request<{ campaigns: CampaignDetail[] }>("GET", "/api/campaigns"),
  campaign: (name: string) => request<Campaign>("GET", `/api/campaigns/${e(name)}`),
  createCampaign: (body: CampaignBody) => request<CampaignSummary>("POST", "/api/campaigns", body),
  updateCampaign: (name: string, body: Partial<CampaignBody>) => request<CampaignSummary>("PATCH", `/api/campaigns/${e(name)}`, body),
  setActive: (name: string, active: boolean) => request<{ name: string; active: boolean }>("POST", `/api/campaigns/${e(name)}/active`, { active }),
  validateCampaigns: () => request<{ campaigns: CampaignSummary[] }>("POST", "/api/campaigns/validate"),

  // ---- settings (the Config tab AutoBooker reads) ----
  settings: () => request<Settings>("GET", "/api/settings"),
  saveSettings: (patch: Record<string, string | number | boolean>) => request<{ values: Record<string, string> }>("PUT", "/api/settings", patch),
};
