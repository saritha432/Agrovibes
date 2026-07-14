/**
 * Soft farming-content policy for Cropvibe publish API (mirrors mobile helper).
 * Go-live: require topic + confirmation; soft-block clearly off-topic captions.
 */

const FARMING_TOPICS = new Set([
  "crops",
  "livestock",
  "machinery",
  "market",
  "soil",
  "weather",
  "community",
  "other"
]);

const FARMING_SIGNAL_RE =
  /\b(farm|farmer|farming|agri|agriculture|crop|crops|harvest|soil|seed|seeds|tractor|irrigation|cattle|cow|goat|poultry|chicken|dairy|fertilizer|organic|paddy|rice|wheat|maize|cotton|sugarcane|horticulture|orchard|greenhouse|mandi|livestock|fodder|manure|compost|vegetables?|fruits?|plantation|agronomy|veterinary|kheti|kisaan|kisan|fasal)\b/i;

const CLEARLY_OFF_TOPIC_RE =
  /\b(party\b|nightclub|clubbing|meme\b|cricket match|football match|bollywood|bikini|makeup tutorial|gaming|pubg|freefire|onlyfans|dating|hookup)\b/i;

function stripPostTypePrefix(caption) {
  return String(caption || "")
    .replace(/^\[(?:POST|REEL|LIVE|STORY)\]\s*/i, "")
    .trim();
}

function hasFarmingSignal(text) {
  return FARMING_SIGNAL_RE.test(String(text || ""));
}

function looksClearlyOffTopic(text) {
  const raw = stripPostTypePrefix(text);
  if (!raw) return false;
  if (hasFarmingSignal(raw)) return false;
  return CLEARLY_OFF_TOPIC_RE.test(raw);
}

function isValidFarmingTopicId(value) {
  return typeof value === "string" && FARMING_TOPICS.has(value.trim().toLowerCase());
}

/**
 * @returns {{ ok: true, farmingTopic: string|null } | { ok: false, status: number, message: string }}
 */
function evaluateFarmingPostPolicy({ caption, farmingTopic, farmingConfirmed, isLivePost }) {
  if (isLivePost) {
    return { ok: true, farmingTopic: isValidFarmingTopicId(farmingTopic) ? String(farmingTopic).toLowerCase() : null };
  }
  if (!farmingConfirmed) {
    return {
      ok: false,
      status: 400,
      message: "Please confirm this post is farming or agriculture related before publishing."
    };
  }
  if (!isValidFarmingTopicId(farmingTopic)) {
    return {
      ok: false,
      status: 400,
      message: "Select a farming topic for your post (crops, livestock, market, etc.)."
    };
  }
  if (looksClearlyOffTopic(caption)) {
    return {
      ok: false,
      status: 400,
      message:
        "This caption looks unrelated to farming. Cropvibe is for agricultural content — update your caption or choose a farming topic that matches your media."
    };
  }
  return { ok: true, farmingTopic: String(farmingTopic).toLowerCase() };
}

module.exports = {
  evaluateFarmingPostPolicy,
  isValidFarmingTopicId,
  looksClearlyOffTopic
};
