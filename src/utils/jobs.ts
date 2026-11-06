import type { PipelineRow } from "../api/types";

/** Role families for the "Role" filter, matched on words in the job title. First match wins. */
const FAMILIES: [string, RegExp][] = [
  ["IBM i / ERP", /\b(rpg|ibm\s?i|as\/?400|iseries|sap|oracle|erp|cobol|mainframe)\b/i],
  ["Data / AI", /\b(data|ai|ml|machine learning|analytics|scientist|bi)\b/i],
  ["Software", /\b(software|developer|engineer|devops|cloud|frontend|backend|full[- ]?stack|architect|qa|sre|java|python|react|\.net)\b/i],
  ["Healthcare", /\b(nurse|rn|medical|clinical|physician|pharma|health|therapist)\b/i],
  ["Finance", /\b(accountant|accounting|finance|financial|controller|cfo|audit|payroll|tax|claims)\b/i],
  ["Sales", /\b(sales|account executive|business development|marketing|sdr|bdr)\b/i],
  ["Manufacturing", /\b(plant|manufacturing|mechanical|electrical|quality|maintenance|production)\b/i],
  ["Operations / HR", /\b(operations|hr|human resources|recruiter|talent|office|customer|supply chain|logistics)\b/i],
];

export function roleFamily(role: string): string {
  return FAMILIES.find(([, re]) => re.test(role))?.[0] ?? "Other";
}

/** "post" for a person's LinkedIn post, "listing" for a LinkedIn job page. */
export function sourceKind(row: Pick<PipelineRow, "signal">): "post" | "listing" {
  return row.signal?.url && /\/(posts|feed)\//.test(row.signal.url) ? "post" : "listing";
}

export const isReviewable = (status: string) => status === "Ready for Review" || status === "Needs Rewrite";

/** Plain names for the boards the engine reads. */
export const BOARD_LABEL: Record<string, string> = {
  indeed: "Indeed", linkedin: "LinkedIn", monster: "Monster", monster_apify: "Monster", google_jobs: "Google Jobs", glassdoor: "Glassdoor", zip_recruiter: "ZipRecruiter", ziprecruiter: "ZipRecruiter",
};
export const boardLabel = (b?: string): string => (b ? BOARD_LABEL[b.split(":")[0]!] ?? b : "");

/** The board a link points to, from its host: "monster.com/job-openings/…" -> "Monster". Empty for a company site. */
export function boardFromUrl(url?: string | null): string {
  if (!url) return "";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const m = /(^|\.)(linkedin|indeed|monster|glassdoor|ziprecruiter|dice|careerbuilder|simplyhired|clearancejobs)\./.exec(host + ".");
    return m ? BOARD_LABEL[m[2]!] ?? m[2]!.charAt(0).toUpperCase() + m[2]!.slice(1) : "";
  } catch {
    return "";
  }
}

/** "Posts by board: Indeed 12 · LinkedIn 8 · Google Jobs 5 (3 on Monster)" or "". */
export function boardsText(by?: Record<string, number>, onMonster?: number): string {
  if (!by || !Object.keys(by).length) return "";
  const parts = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${boardLabel(k)} ${v}`);
  return `${parts.join(" · ")}${onMonster ? ` (${onMonster} on Monster)` : ""}`;
}

/** Plain words for the reasons a post was not kept. */
export const SKIP_LABEL: Record<string, string> = {
  STAFFING_OR_CONSULTING_FIRM: "staffing or consulting firm",
  NO_EMAIL: "no email found",
  NO_EMAIL_IN_EARLIER_RUN: "no email in an earlier run",
  LOOKUP_LIMIT: "Seamless limit reached",
  LOOKUP_ERROR: "Seamless lookup failed",
  SAME_CONTACT_AS_ANOTHER_JOB: "same contact as another post",
  FOUND_BY_EARLIER_SEARCH: "found by an earlier search",
  DUPLICATE: "duplicate post",
  OUTSIDE_DATE_WINDOW: "older than the window",
  NOT_A_LINKEDIN_JOB_URL: "not a job link",
};
export function skipsText(by?: Record<string, number>): string {
  if (!by || !Object.keys(by).length) return "";
  return Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${SKIP_LABEL[k] ?? k.toLowerCase().replace(/_/g, " ")} ${v}`).join(" · ");
}
