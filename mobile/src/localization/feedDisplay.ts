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

/** True when a label is only digits / phone formatting — never show as a person's name. */
export function looksLikePhoneNumber(value: string): boolean {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return false;
  const letters = trimmed.match(/[a-zA-Z\u0900-\u097F\u0C00-\u0C7F]/g);
  return !letters || letters.length === 0;
}

/** Username the user chose in Edit Profile — not phone/login id auto-filled from registration. */
export function isChosenUsername(
  username?: string | null,
  options?: { phone?: string | null; email?: string | null }
): boolean {
  const bare = String(username || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
  if (!bare) return false;
  if (looksLikePhoneNumber(bare)) return false;
  if (bare.includes("@phone.agrovibes")) return false;
  const phoneDigits = String(options?.phone || "")
    .replace(/\D/g, "")
    .slice(-10);
  const emailLocal = String(options?.email || "")
    .split("@")[0]
    .replace(/\D/g, "")
    .slice(-10);
  const bareDigits = bare.replace(/\D/g, "").slice(-10);
  if (phoneDigits.length >= 10 && bareDigits === phoneDigits) return false;
  if (emailLocal.length >= 10 && bareDigits === emailLocal) return false;
  return true;
}

/** @handle for profile when user set a username; otherwise null. */
export function formatProfileHandle(
  username?: string | null,
  options?: { phone?: string | null; email?: string | null }
): string | null {
  if (!isChosenUsername(username, options)) return null;
  return `@${String(username).trim().replace(/^@+/, "")}`;
}

/** Prefer real names; skip phone numbers and synthetic emails used as identifiers. */
export function resolvePersonDisplayName(options: {
  fullName?: string | null;
  username?: string | null;
  fallback?: string | null;
  phone?: string | null;
  email?: string | null;
}): string {
  const chosenUsername = isChosenUsername(options.username, options)
    ? String(options.username || "")
        .trim()
        .replace(/^@+/, "")
    : null;
  const candidates = [options.fullName, options.fallback]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  for (const candidate of candidates) {
    if (looksLikePhoneNumber(candidate)) continue;
    if (candidate.includes("@phone.agrovibes")) continue;
    return candidate;
  }
  if (chosenUsername) return chosenUsername;
  return "User";
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
  const trimmed = resolvePersonDisplayName({ fullName: name, fallback: name });
  if (!trimmed || trimmed === "User") return trimmed;

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

/** Music line when creator attached a track or labeled audio. */
export function postMusicDisplayLabel(
  post: { musicLabel?: string | null; caption?: string | null },
  language: AppLanguage,
  t: TranslateFn
): string | null {
  const musicSource = String(post.musicLabel || "").trim();
  if (!musicSource) return null;
  return formatFeedText(musicSource, language, t);
}

export function postShowsMusicRow(post: {
  musicLabel?: string | null;
  musicAudioUrl?: string | null;
}): boolean {
  return Boolean(String(post.musicLabel ?? "").trim() || String(post.musicAudioUrl ?? "").trim());
}

/** Chat share card label — keeps [REEL] / [POST] prefix visible like Instagram. */
export function sharedReelCardCaption(caption?: string | null): string {
  const raw = String(caption || "").trim();
  if (/^\[(?:POST|REEL|LIVE|STORY)\]/i.test(raw)) {
    return raw.split("\n")[0].trim();
  }
  const stripped = stripInternalCaptionPrefix(raw);
  if (stripped) {
    const kind = /^\[POST\]/i.test(raw) ? "POST" : "REEL";
    return `[${kind}] ${stripped}`;
  }
  return /^\[POST\]/i.test(raw) ? "[POST]" : "[REEL]";
}
