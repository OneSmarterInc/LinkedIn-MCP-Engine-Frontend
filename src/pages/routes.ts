/** The six pages, in rail order, with the titles and subtitles from the design. */
export const PAGES = ["queue", "jobs", "pipeline", "campaigns", "runs", "automation"] as const;
export type Page = (typeof PAGES)[number];

export const PAGE_INFO: Record<Page, { label: string; title: string; subtitle: string }> = {
  queue: { label: "Review queue", title: "Review queue", subtitle: "Approve, edit or reject drafts. Approved rows are sent by AutoBooker." },
  jobs: { label: "Job posts", title: "Job posts", subtitle: "People who said in public they are hiring, last 7 days" },
  pipeline: { label: "Pipeline", title: "Pipeline", subtitle: "Every email in flight, from both the lead and job flows" },
  campaigns: { label: "Campaigns", title: "Campaigns", subtitle: "What we look for, where, and what we offer" },
  runs: { label: "Runs", title: "Runs", subtitle: "Start a search and watch it work" },
  automation: { label: "Automation", title: "Automation", subtitle: "What runs without you, and the guard rails" },
};
