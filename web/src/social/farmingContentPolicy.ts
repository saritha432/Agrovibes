/** Soft farming-content policy helpers for Cropvibe web publish. */

export const FARMING_TOPICS = [
  { id: "crops", label: "Crops" },
  { id: "livestock", label: "Livestock" },
  { id: "machinery", label: "Machinery" },
  { id: "market", label: "Market" },
  { id: "soil", label: "Soil & inputs" },
  { id: "weather", label: "Weather" },
  { id: "community", label: "Community" },
  { id: "other", label: "Other agri" }
] as const;

export type FarmingTopicId = (typeof FARMING_TOPICS)[number]["id"];

const FARMING_SIGNAL_RE =
  /\b(farm|farmer|farming|agri|agriculture|crop|crops|harvest|soil|seed|seeds|tractor|irrigation|cattle|cow|goat|poultry|chicken|dairy|fertilizer|organic|paddy|rice|wheat|maize|cotton|sugarcane|horticulture|orchard|greenhouse|mandi|livestock|fodder|manure|compost|vegetables?|fruits?|plantation|agronomy|veterinary|kheti|kisaan|kisan|fasal)\b/i;

const CLEARLY_OFF_TOPIC_RE =
  /\b(party\b|nightclub|clubbing|meme\b|cricket match|football match|bollywood|bikini|makeup tutorial|gaming|pubg|freefire|onlyfans|dating|hookup)\b/i;

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

export function evaluateFarmingPostPolicy(input: {
  caption: string;
  farmingTopicId?: string | null;
  farmingConfirmed?: boolean;
}): { ok: true } | { ok: false; message: string } {
  if (!input.farmingConfirmed) {
    return { ok: false, message: "Please confirm this post is farming or agriculture related before publishing." };
  }
  if (!String(input.farmingTopicId || "").trim()) {
    return { ok: false, message: "Select a farming topic for your post (crops, livestock, market, etc.)." };
  }
  if (looksClearlyOffTopic(input.caption)) {
    return {
      ok: false,
      message:
        "This caption looks unrelated to farming. Cropvibe is for agricultural content — update your caption or choose a farming topic that matches your media."
    };
  }
  return { ok: true };
}
