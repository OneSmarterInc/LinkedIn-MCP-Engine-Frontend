import type { PipelineRow } from "../api/types";

/**
 * Quick checks on a draft, shown as green/red pills in the review drawer (same checks as the design).
 * The engine applies the full rules when it writes a draft; these help a person who edits one by hand.
 */
const BANNED = /hope this email finds you|hope you are doing well|hope you're doing well|reach out|synergy|leverage|circle back|touch base/i;

export function draftChecks(row: Pick<PipelineRow, "company" | "signal">, subject: string, body: string): [label: string, ok: boolean][] {
  if (!body.trim()) return [];
  const text = body.toLowerCase();
  const companyWord = row.company.toLowerCase().replace(/^the\s+/, "").split(/[\s,]+/)[0] ?? "";
  const roleWord = row.signal?.role.toLowerCase().replace(/\(.*?\)/g, "").trim().split(/\s+/).pop() ?? "";
  const sentences = body.trim().split(/(?<=[.!?])\s+/).filter((s) => s.trim()).length;
  const subjectWords = subject.trim().split(/\s+/).filter(Boolean).length;
  return [
    ...(row.signal ? [["Names the role", !roleWord || text.includes(roleWord)] as [string, boolean]] : []),
    ["Names the company", !companyWord || text.includes(companyWord)],
    ["4 sentences", sentences === 4],
    ["Ends with a question", body.trim().endsWith("?")],
    ["Subject 7 words or fewer", subjectWords > 0 && subjectWords <= 7],
    ["No banned phrases", !BANNED.test(`${subject} ${body}`)],
  ];
}
