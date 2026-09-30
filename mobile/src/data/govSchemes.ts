export type GovSchemeCategory =
  | "income"
  | "insurance"
  | "mechanisation"
  | "irrigation"
  | "credit"
  | "soil"
  | "market"
  | "pension"
  | "development"
  | "advisory";

export type GovScheme = {
  id: string;
  name: string;
  category: GovSchemeCategory;
  categoryLabel: string;
  summary: string;
  description: string;
  whoFor: string;
  documents: string;
  note?: string;
  officialUrl: string;
  deadlineLabel: string;
  verifiedLabel: string;
  alwaysRelevant?: boolean;
  relevanceKeywords?: string[];
};

export const GOV_SCHEME_CATEGORIES: { id: GovSchemeCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "income", label: "Income support" },
  { id: "insurance", label: "Insurance" },
  { id: "mechanisation", label: "Farm mechanisation" },
  { id: "irrigation", label: "Irrigation" },
  { id: "credit", label: "Credit" },
  { id: "soil", label: "Soil & inputs" },
  { id: "market", label: "Market" },
  { id: "pension", label: "Pension" },
  { id: "development", label: "Agri development" },
  { id: "advisory", label: "Farmer services" }
];

/** Curated central agri schemes with official Government of India URLs only. */
export const GOV_SCHEMES: GovScheme[] = [
  {
    id: "pm-kisan",
    name: "PM-KISAN",
    category: "income",
    categoryLabel: "Income support",
    summary: "Income support instalment window is open. Check status on the official site.",
    description:
      "Pradhan Mantri Kisan Samman Nidhi provides income support to eligible landholding farmer families in three instalments each year. CropVibe only lists the official beneficiary portal — we cannot show live payment status.",
    whoFor: "farmers with land records in the opted-in state profile",
    documents: "Aadhaar, bank, land record — confirm on the official site",
    note: "CropVibe cannot show live PM-KISAN payment status. Use the official beneficiary page.",
    officialUrl: "https://pmkisan.gov.in/",
    deadlineLabel: "28 Sep 2026",
    verifiedLabel: "12 Sep 2026",
    alwaysRelevant: true
  },
  {
    id: "pmfby",
    name: "PM Fasal Bima Yojana",
    category: "insurance",
    categoryLabel: "Crop insurance",
    summary: "Crop insurance information and official apply link. CropVibe is not an authorised seller of insurance.",
    description:
      "Pradhan Mantri Fasal Bima Yojana is the Government of India crop insurance scheme. Enrolment, premium, and claims are handled only on the official PMFBY portal or notified state channels.",
    whoFor: "notified farmers growing notified crops in notified areas for the season",
    documents: "Aadhaar, bank account, land / sowing details — confirm on the official site",
    note: "CropVibe is not an authorised seller of insurance.",
    officialUrl: "https://pmfby.gov.in/",
    deadlineLabel: "15 Oct 2026",
    verifiedLabel: "12 Sep 2026",
    alwaysRelevant: true
  },
  {
    id: "smam",
    name: "Sub-Mission on Agricultural Mechanisation",
    category: "mechanisation",
    categoryLabel: "Farm mechanisation",
    summary: "Support for custom hiring centres and machinery. Likely relevant if you rent equipment.",
    description:
      "SMAM supports farm machinery, custom hiring centres, and related subsidies through state agriculture departments. Applications and beneficiary lists are only on the official agrimachinery portal.",
    whoFor: "farmers with land records in the opted-in state profile",
    documents: "Aadhaar, bank, land record — confirm on the official site",
    officialUrl: "https://agrimachinery.nic.in/",
    deadlineLabel: "30 Nov 2026",
    verifiedLabel: "12 Sep 2026",
    alwaysRelevant: true,
    relevanceKeywords: ["tractor", "hire", "rental", "mechanis"]
  },
  {
    id: "pmksy",
    name: "PM Krishi Sinchayee Yojana",
    category: "irrigation",
    categoryLabel: "Irrigation",
    summary: "Micro-irrigation and water-use efficiency support. Apply only through the official PMKSY site.",
    description:
      "PMKSY (including Per Drop More Crop) supports drip, sprinkler, and related irrigation work. CropVibe does not process subsidy claims.",
    whoFor: "farmers investing in notified micro-irrigation systems in participating states",
    documents: "Aadhaar, bank, land record, and irrigation quotation — confirm on the official site",
    officialUrl: "https://pmksy.gov.in/",
    deadlineLabel: "31 Dec 2026",
    verifiedLabel: "12 Sep 2026",
    alwaysRelevant: true
  },
  {
    id: "kcc",
    name: "Kisan Credit Card",
    category: "credit",
    categoryLabel: "Farm credit",
    summary: "Short-term crop credit through banks. CropVibe is not a lender — use the official MyScheme / bank channel.",
    description:
      "Kisan Credit Card is a Government of India facility delivered by banks. Interest subvention and eligibility are decided by the bank and the official scheme rules.",
    whoFor: "eligible farmers, tenant farmers, and sharecroppers as notified by the lending bank",
    documents: "Aadhaar, bank KYC, land / tenancy proof — confirm with the bank and official page",
    officialUrl: "https://www.myscheme.gov.in/schemes/kcc",
    deadlineLabel: "Open window",
    verifiedLabel: "12 Sep 2026",
    alwaysRelevant: true
  },
  {
    id: "soil-health-card",
    name: "Soil Health Card",
    category: "soil",
    categoryLabel: "Soil & inputs",
    summary: "Test soil and get nutrient advice from the official Soil Health Card portal.",
    description:
      "The Soil Health Card scheme issues test-based nutrient recommendations. Sampling and cards are managed by state agriculture departments via the official portal.",
    whoFor: "farmers who want official soil test recommendations for their plot",
    documents: "Aadhaar and land / plot details — confirm on the official site",
    officialUrl: "https://www.soilhealth.dac.gov.in/",
    deadlineLabel: "Open window",
    verifiedLabel: "12 Sep 2026",
    alwaysRelevant: true
  },
  {
    id: "enam",
    name: "eNAM",
    category: "market",
    categoryLabel: "Market",
    summary: "National agriculture market for notified mandis. Trade only on the official eNAM site.",
    description:
      "eNAM is the Government of India electronic national agriculture market. Registration, lots, and payments are only on the official portal.",
    whoFor: "farmers, traders, and FPOs in notified eNAM mandis",
    documents: "Aadhaar, bank, and APMC / FPO registration as required on the official site",
    officialUrl: "https://www.enam.gov.in/web/",
    deadlineLabel: "Open window",
    verifiedLabel: "12 Sep 2026",
    alwaysRelevant: true
  },
  {
    id: "pmkmy",
    name: "PM Kisan Maandhan Yojana",
    category: "pension",
    categoryLabel: "Pension",
    summary: "Voluntary pension for small and marginal farmers. Enrol only on the official Maandhan site.",
    description:
      "PM-KMY is a Government of India pension scheme for eligible small and marginal farmers. CropVibe does not collect premiums or show NPS account status.",
    whoFor: "small and marginal farmers in the notified age band who are not already in another statutory pension",
    documents: "Aadhaar, bank, and land record — confirm on the official site",
    officialUrl: "https://maandhan.in/",
    deadlineLabel: "Open window",
    verifiedLabel: "12 Sep 2026",
    alwaysRelevant: true
  },
  {
    id: "rkvy",
    name: "Rashtriya Krishi Vikas Yojana",
    category: "development",
    categoryLabel: "Agri development",
    summary: "State-led agriculture development projects. Guidelines and MIS are only on the official RKVY site.",
    description:
      "RKVY (Rashtriya Krishi Vikas Yojana) funds state agriculture and allied-sector projects. CropVibe does not process state project applications.",
    whoFor: "farmers and allied groups as notified in each state's RKVY projects",
    documents: "Aadhaar, bank, and project / land papers as listed on the official site",
    officialUrl: "https://rkvy.nic.in/",
    deadlineLabel: "Open window",
    verifiedLabel: "29 Sep 2026",
    alwaysRelevant: true
  },
  {
    id: "kisan-suvidha",
    name: "Kisan Suvidha",
    category: "advisory",
    categoryLabel: "Farmer services",
    summary: "Official farmer app and portal for weather, markets, and scheme information.",
    description:
      "Kisan Suvidha is a Government of India farmer services portal and app. CropVibe links only to the official site.",
    whoFor: "farmers seeking official weather, mandi, and scheme information",
    documents: "Register on the official Kisan Suvidha site or app",
    officialUrl: "https://kisansuvidha.gov.in/",
    deadlineLabel: "Open window",
    verifiedLabel: "29 Sep 2026",
    alwaysRelevant: true
  },
  {
    id: "mkisan",
    name: "mKisan",
    category: "advisory",
    categoryLabel: "Farmer services",
    summary: "Official SMS and mobile advisories from the Ministry of Agriculture.",
    description:
      "mKisan delivers government agri advisories to registered mobile numbers. Subscription and messages are only on the official mKisan portal.",
    whoFor: "farmers who want official crop and weather SMS advisories",
    documents: "Mobile number registration on the official mKisan site",
    officialUrl: "https://mkisan.gov.in/",
    deadlineLabel: "Open window",
    verifiedLabel: "29 Sep 2026",
    alwaysRelevant: true
  }
];

export function getGovSchemeById(id: string): GovScheme | undefined {
  return GOV_SCHEMES.find((row) => row.id === id);
}

export function isSchemeLikelyRelevant(scheme: GovScheme, locationLabel?: string | null): boolean {
  if (scheme.alwaysRelevant) return true;
  const loc = String(locationLabel || "").toLowerCase();
  if (!loc) return false;
  return (scheme.relevanceKeywords || []).some((key) => loc.includes(key.toLowerCase()));
}

export function searchGovSchemes(query: string, rows: GovScheme[] = GOV_SCHEMES): GovScheme[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    [row.name, row.summary, row.categoryLabel, row.description].join(" ").toLowerCase().includes(q)
  );
}

export function formatSchemeDeadline(scheme: GovScheme): string {
  return `Deadline ${scheme.deadlineLabel} · last verified ${scheme.verifiedLabel}`;
}
