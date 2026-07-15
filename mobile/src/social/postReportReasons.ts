export const POST_REPORT_REASONS = [
  { key: "spam", labelKey: "reportSpam" },
  { key: "fake_advice", labelKey: "reportFakeAdvice" },
  { key: "harmful_chemicals", labelKey: "reportHarmfulChemicals" },
  { key: "copyright", labelKey: "reportCopyright" },
  { key: "harassment", labelKey: "reportHarassment" },
  { key: "inappropriate", labelKey: "reportInappropriate" },
  { key: "scam", labelKey: "reportScam" },
  { key: "other", labelKey: "reportOther" }
] as const;

export type PostReportReasonKey = (typeof POST_REPORT_REASONS)[number]["key"];
