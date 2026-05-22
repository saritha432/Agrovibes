import React from "react";
import type { AppLanguage } from "./LanguageContext";
import { translateText } from "../services/api";

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

export function shouldTranslateDynamicText(language: AppLanguage, text: string, token?: string | null) {
  return language !== "English" && !!token && normalizeDynamicText(text).length > 0;
}

export function useDynamicTranslations(token: string | null | undefined, language: AppLanguage) {
  const [translations, setTranslations] = React.useState<Record<string, string>>({});
  const inFlightRef = React.useRef(new Set<string>());

  const getTranslation = React.useCallback(
    (text: string, fallback?: string) => {
      const normalized = normalizeDynamicText(text);
      if (!normalized || language === "English") return fallback ?? text;
      return translations[translationKey(language, normalized)] ?? fallback ?? text;
    },
    [language, translations]
  );

  const requestTranslation = React.useCallback(
    async (text: string, contentType: ContentType = "post") => {
      const cleaned = cleanDynamicText(text);
      if (!shouldTranslateDynamicText(language, cleaned, token)) return;
      const key = translationKey(language, cleaned);
      if (translations[key] || inFlightRef.current.has(key)) return;

      inFlightRef.current.add(key);
      try {
        const result = await translateText(token!, {
          text: cleaned,
          targetLanguage: language,
          contentType
        });
        const translated = String(result.translatedText || "").trim();
        if (translated) {
          setTranslations((prev) => (prev[key] ? prev : { ...prev, [key]: translated }));
        }
      } catch {
        // Dynamic content should never block feeds, comments, or chats.
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [language, token, translations]
  );

  const requestTranslations = React.useCallback(
    (items: { text: string | null | undefined; contentType?: ContentType }[]) => {
      if (language === "English" || !token) return;
      for (const item of items) {
        const text = String(item.text || "").trim();
        if (text) void requestTranslation(text, item.contentType ?? "post");
      }
    },
    [language, requestTranslation, token]
  );

  return { getTranslation, requestTranslation, requestTranslations };
}
