/** Soft farming-content policy helpers for Cropvibe go-live. */

export const FARMING_TOPICS = [
  { id: "crops", labelKey: "farmingTopicCrops" as const },
  { id: "livestock", labelKey: "farmingTopicLivestock" as const },
  { id: "machinery", labelKey: "farmingTopicMachinery" as const },
  { id: "market", labelKey: "farmingTopicMarket" as const },
  { id: "soil", labelKey: "farmingTopicSoil" as const },
  { id: "weather", labelKey: "farmingTopicWeather" as const },
  { id: "community", labelKey: "farmingTopicCommunity" as const },
  { id: "other", labelKey: "farmingTopicOther" as const }
] as const;

export type FarmingTopicId = (typeof FARMING_TOPICS)[number]["id"];

const FARMING_SIGNAL_RE =
  /\b(farm|farmer|farming|agri|agriculture|crop|crops|harvest|soil|seed|seeds|tractor|irrigation|cattle|cow|goat|poultry|chicken|dairy|fertilizer|organic|paddy|rice|wheat|maize|cotton|sugarcane|horticulture|orchard|greenhouse|mandi|livestock|fodder|manure|compost|vegetables?|fruits?|plantation|agronomy|veterinary|kheti|kisaan|kisan|fasal|பயிர்|விவசாய|వ్యవసాయ|పంట|কৃষি|खेत|किसान|फसल|పశువు|పశువులు)\b/i;

const CLEARLY_OFF_TOPIC_RE =
  /\b(party\b|nightclub|clubbing|meme\b|cricket match|football match|bollywood|hollywood|makeup tutorial|gaming|pubg|freefire|onlyfans|dating|hookup)\b/i;

export function stripPostTypePrefix(caption: string): string {
  return String(caption || "")
    .replace(/^\[(?:POST|REEL|LIVE|STORY)\]\s*/i, "")
    .trim();
}

export function hasFarmingSignal(text: string): boolean {
  return FARMING_SIGNAL_RE.test(String(text || ""));
}

export function looksClearlyOffTopic(text: string): boolean {
  const raw = stripPostTypePrefix(text);
  if (!raw) return false;
  if (hasFarmingSignal(raw)) return false;
  return CLEARLY_OFF_TOPIC_RE.test(raw);
}

/** Soft check used before publish. Topic selection alone is enough for go-live. */
export function evaluateFarmingPostPolicy(input: {
  caption: string;
  farmingTopicId?: string | null;
  farmingConfirmed?: boolean;
}): { ok: true } | { ok: false; code: "topic_required" | "confirm_required" | "off_topic" } {
  if (!input.farmingConfirmed) return { ok: false, code: "confirm_required" };
  if (!String(input.farmingTopicId || "").trim()) return { ok: false, code: "topic_required" };
  if (looksClearlyOffTopic(input.caption)) return { ok: false, code: "off_topic" };
  return { ok: true };
}

export function isValidFarmingTopicId(value: unknown): value is FarmingTopicId {
  return typeof value === "string" && FARMING_TOPICS.some((t) => t.id === value);
}
