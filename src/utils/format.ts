/** Small display helpers shared by every page. */

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral";

/** Pill colour for each Sheet status (the values of the Status dropdown). */
export function statusTone(status: string): Tone {
  switch (status) {
    case "Ready for Review": return "info";
    case "Needs Rewrite": case "Approved": case "Sending": return "warn";
    case "Sent": case "Replied": case "Meeting Booked": return "ok";
    case "Rejected": case "Opted Out": case "Bounced": case "Send Error": case "Quarantined": return "bad";
    default: return "neutral";
  }
}

/** Days since a "YYYY-MM-DD…" date, or undefined when there is none. */
export function daysAgo(date?: string | null, now = new Date()): number | undefined {
  if (!date) return undefined;
  const d = new Date(`${date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
}

/** "today", "1 d ago", "5 d ago", or "date unknown". */
export function ageText(date?: string | null): string {
  const d = daysAgo(date);
  if (d === undefined) return "date unknown";
  return d === 0 ? "today" : `${d} d ago`;
}

/** Seconds/minutes/hours since an ISO time, for "started 3 min ago". */
export function sinceText(iso?: string, now = Date.now()): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}

/** "Today 08:00", "Yesterday 08:00", or "3 Nov 08:00". */
export function whenText(iso?: string, now = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const day = (x: Date) => x.toDateString();
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (day(d) === day(now)) return `Today ${time}`;
  if (day(d) === day(yesterday)) return `Yesterday ${time}`;
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
}

export const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";

/** The greeting line is added by the engine; the editor shows the body without it. */
export const withoutGreeting = (body: string) => body.replace(/^\s*hi [^,\n]*,\s*/i, "");
export const withGreeting = (name: string, body: string) => `Hi ${firstName(name) || "there"},\n\n${body.trim()}`;

/** Link to the Gmail thread AutoBooker started (opens in the account that sent it). */
export const gmailThread = (threadId: string) => `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(threadId)}`;
