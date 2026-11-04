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
