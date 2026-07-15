export const POST_REPORT_REASONS = [
  { key: "spam", labelKey: "reportSpam" },
  { key: "harassment", labelKey: "reportHarassment" },
  { key: "hate", labelKey: "reportHate" },
  { key: "nudity", labelKey: "reportNudity" },
  { key: "violence", labelKey: "reportViolence" },
  { key: "scam", labelKey: "reportScam" },
  { key: "ip", labelKey: "reportIp" },
  { key: "other", labelKey: "reportOther" }
] as const;

export type PostReportReasonKey = (typeof POST_REPORT_REASONS)[number]["key"];
