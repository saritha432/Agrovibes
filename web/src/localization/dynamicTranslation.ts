import { useCallback, useRef, useState } from "react";
import { translateText, type AppLanguage } from "../api/translation";

type ContentType = "post" | "caption" | "comment" | "chat";

function normalizeDynamicText(text: string) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function cleanDynamicText(text: string) {
  return String(text || "").trim();
}

function translationKey(language: AppLanguage, text: string) {
  return `${language}:${normalizeDynamicText(text)}`;
}

export function useDynamicTranslations(token: string | null | undefined, language: AppLanguage) {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const inFlightRef = useRef(new Set<string>());

  const getTranslation = useCallback(
    (text: string, fallback?: string) => {
      const normalized = normalizeDynamicText(text);
      if (!normalized || language === "English") return fallback ?? text;
      return translations[translationKey(language, normalized)] ?? fallback ?? text;
    },
    [language, translations]
  );

  const requestTranslation = useCallback(
    async (text: string, contentType: ContentType = "post") => {
      const cleaned = cleanDynamicText(text);
      if (!token || language === "English" || !cleaned) return;
      const key = translationKey(language, cleaned);
      if (translations[key] || inFlightRef.current.has(key)) return;

      inFlightRef.current.add(key);
      try {
        const result = await translateText(token, {
          text: cleaned,
          targetLanguage: language,
          contentType
        });
        const translated = String(result.translatedText || "").trim();
        if (translated) {
          setTranslations((prev) => (prev[key] ? prev : { ...prev, [key]: translated }));
        }
      } catch {
        // Keep original user content if translation is unavailable.
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [language, token, translations]
  );

  return { getTranslation, requestTranslation };
}
