import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { AppLanguage } from "../api/translation";

const STORAGE_KEY = "cropvibe.web.language";
export const SUPPORTED_LANGUAGES: AppLanguage[] = ["English", "Hindi", "Telugu"];

interface LanguageState {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

const LanguageContext = createContext<LanguageState | null>(null);

function normalizeLanguage(value: string | null | undefined): AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage) ? (value as AppLanguage) : "English";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    try {
      return normalizeLanguage(localStorage.getItem(STORAGE_KEY));
    } catch {
      return "English";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore storage failures
    }
  }, [language]);

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(normalizeLanguage(next));
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

export type { AppLanguage };
