import type { AppLanguage } from "./translations";
import { translateFeedGlossary } from "./feedGlossary";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

const INDIC_SCRIPT_RE = /[\u0900-\u097F\u0C00-\u0C7F]/;

/** English UI / demo strings stored in posts — map to i18n keys for full-sentence translations. */
const KNOWN_FEED_TEXT_KEY: Record<string, string> = {
  "original audio": "originalAudio",
  test: "feedDemoTest",
  testing: "feedDemoTest",
  "test video capture": "feedDemoTestVideoCapture",
  "testing from mobile app camera": "feedTestingFromCamera",
  farmer: "farmerDefaultName"
};

function lookupKnownFeedKey(text: string): string | null {
  const key = text.trim().toLowerCase();
  return KNOWN_FEED_TEXT_KEY[key] ?? null;
}

function hasIndicScript(text: string): boolean {
  return INDIC_SCRIPT_RE.test(text);
}

function isMostlyLatin(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  return letters.length > 0 && !hasIndicScript(text);
}

/** Remove internal type markers added at publish time ([POST], [REEL], [LIVE], [STORY]). */
export function stripInternalCaptionPrefix(caption?: string | null): string {
  return String(caption || "")
    .replace(/^\[(?:POST|REEL|LIVE|STORY)\]\s*/i, "")
    .trim();
}

/** @deprecated Use stripInternalCaptionPrefix */
export function stripReelCaptionPrefix(caption?: string | null): string {
  return stripInternalCaptionPrefix(caption);
}

/**
 * Localize feed/reel text: app strings first, then glossary (real meanings, not sound-alike script).
 * Unknown English words stay in English.
 */
export function formatFeedText(text: string, language: AppLanguage, t: TranslateFn): string {
  const trimmed = String(text || "").trim();
  if (!trimmed) return trimmed;

  const knownKey = lookupKnownFeedKey(trimmed);
  if (knownKey) return t(knownKey);

  const userMatch = /^user\s+(\d+)$/i.exec(trimmed);
  if (userMatch) return t("userWithId", { id: userMatch[1] });

  if (trimmed === "You") return t("you");

  if (language === "English" || !isMostlyLatin(trimmed)) return trimmed;
  return translateFeedGlossary(trimmed, language);
}

/**
 * Person names: only system labels (You, User N, Farmer). Real names are not phonetic-transliterated.
 */
export function formatDisplayName(name: string, language: AppLanguage, t: TranslateFn): string {
  const trimmed = String(name || "").trim();
  if (!trimmed) return trimmed;

  const knownKey = lookupKnownFeedKey(trimmed);
  if (knownKey) return t(knownKey);

  const userMatch = /^user\s+(\d+)$/i.exec(trimmed);
  if (userMatch) return t("userWithId", { id: userMatch[1] });

  if (trimmed === "You") return t("you");

  if (language === "English" || hasIndicScript(trimmed)) return trimmed;

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount === 1) {
    const gloss = translateFeedGlossary(trimmed, language);
    if (gloss !== trimmed) return gloss;
  }

  return trimmed;
}

export function formatReelCaption(caption: string | null | undefined, language: AppLanguage, t: TranslateFn): string {
  const stripped = stripInternalCaptionPrefix(caption);
  if (!stripped) return "";
  return formatFeedText(stripped, language, t);
}
