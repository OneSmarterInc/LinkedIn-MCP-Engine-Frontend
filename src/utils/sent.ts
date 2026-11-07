import type { PipelineRow } from "../api/types";

/** What became of an email AutoBooker sent. */
export type SentKind = "replied" | "meeting" | "not_now" | "no_reply" | "bounced" | "opted_out";

export const SENT_KINDS: Array<{ kind: SentKind | "all"; label: string }> = [
  { kind: "all", label: "All sent" },
  { kind: "replied", label: "Replied" },
  { kind: "meeting", label: "Meeting booked" },
  { kind: "no_reply", label: "No reply yet" },
  { kind: "not_now", label: "Not interested" },
  { kind: "bounced", label: "Bounced / opted out" },
];

export const KIND_PILL: Record<SentKind, { label: string; tone: "ok" | "info" | "warn" | "bad" | "neutral" }> = {
  replied: { label: "Replied", tone: "ok" },
  meeting: { label: "Meeting booked", tone: "info" },
  not_now: { label: "Not interested", tone: "neutral" },
  no_reply: { label: "Sent", tone: "warn" },
  bounced: { label: "Bounced", tone: "bad" },
  opted_out: { label: "Opted out", tone: "bad" },
};

/** The kind of a row, or undefined when it was never sent (drafts, approved, send errors). */
export function sentKind(r: PipelineRow): SentKind | undefined {
  switch (r.status) {
    case "Meeting Booked": return "meeting";
    case "Bounced": return "bounced";
    case "Opted Out": return "opted_out";
    case "Replied": return /\b(declined|not interested)\b/i.test(r.notes ?? "") ? "not_now" : "replied";
    case "Sent": return "no_reply";
    default: return undefined;
  }
}

/** The filter a kind belongs to ("bounced" covers opted out too). */
export const filterOf = (k: SentKind): SentKind => (k === "opted_out" ? "bounced" : k);

/** A Sheet time ("2026-11-07 10:05" or ISO) as milliseconds, NaN when empty or unreadable. */
export function sheetTime(v?: string): number {
  if (!v) return NaN;
  return Date.parse(/^\d{4}-\d{2}-\d{2} \d/.test(v) ? v.replace(" ", "T") : v);
}

/** ISO text for whenText(), or undefined. */
export const isoOf = (v?: string): string | undefined => {
  const t = sheetTime(v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
};

/** The rows that were sent, newest send first. */
export function sentRows(rows: PipelineRow[]): Array<PipelineRow & { kind: SentKind }> {
  return rows
    .map((r) => ({ r, kind: sentKind(r) }))
    .filter((x): x is { r: PipelineRow; kind: SentKind } => Boolean(x.kind))
    .map(({ r, kind }) => ({ ...r, kind }))
    .sort((a, b) => (sheetTime(b.sent_at) || 0) - (sheetTime(a.sent_at) || 0));
}

// "New reply" = a reply after the last time this browser opened the page. Per browser only; a light convenience.
const SEEN_KEY = "outreach:sent-seen-at";
export function seenAt(): number {
  try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; }
}
export function markSeen(at = Date.now()): void {
  try { localStorage.setItem(SEEN_KEY, String(at)); window.dispatchEvent(new Event(SEEN_KEY)); } catch { /* private window: no badge memory */ }
}
export const SEEN_EVENT = SEEN_KEY;

export const isNewReply = (r: PipelineRow, since: number) => {
  const t = sheetTime(r.last_reply_at);
  return !Number.isNaN(t) && t > since && ["Replied", "Meeting Booked"].includes(r.status);
};

/** Notes lines without the date prefix, oldest first: what AutoBooker (or a person) did. */
export function noteLines(notes?: string): Array<{ at?: string; text: string }> {
  return (notes ?? "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+(.*)$/.exec(l);
    return m ? { at: m[1], text: m[2]! } : { text: l };
  });
}
