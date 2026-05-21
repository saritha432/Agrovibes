import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import {
  AppLanguage,
  ENGLISH_FALLBACK,
  I18N_RESOURCES,
  SUPPORTED_LANGUAGES,
  TRANSLATIONS
} from "./translations";

const STORAGE_KEY = "agrovibes.app.language.v1";
const DEFAULT_LANGUAGE: AppLanguage = "English";

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  loading: boolean;
};

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

function isSupportedLanguage(value: string | null | undefined): value is AppLanguage {
  return !!value && SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

function LanguageContextBridge({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<AppLanguage>(
    isSupportedLanguage(i18next.language) ? i18next.language : DEFAULT_LANGUAGE
  );

  React.useEffect(() => {
    const onLanguageChanged = (lng: string) => {
      if (isSupportedLanguage(lng)) setLanguageState(lng);
    };
    i18next.on("languageChanged", onLanguageChanged);
    return () => {
      i18next.off("languageChanged", onLanguageChanged);
    };
  }, []);

  const setLanguage = React.useCallback(async (next: AppLanguage) => {
    if (!isSupportedLanguage(next)) return;
    await i18next.changeLanguage(next);
    setLanguageState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = React.useCallback(
    (key: string, params?: Record<string, string | number>) =>
      i18next.t(key, {
        ...params,
        defaultValue: ENGLISH_FALLBACK[key] || TRANSLATIONS.English[key] || key
      }),
    [language]
  );

  const value = React.useMemo(() => ({ language, setLanguage, t, loading: false }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(i18next.isInitialized);

  React.useEffect(() => {
    if (i18next.isInitialized) {
      setReady(true);
      return;
    }
    let mounted = true;
    (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const initialLanguage = isSupportedLanguage(raw) ? raw : DEFAULT_LANGUAGE;
      await i18next.use(initReactI18next).init({
        resources: I18N_RESOURCES,
        lng: initialLanguage,
        fallbackLng: DEFAULT_LANGUAGE,
        supportedLngs: SUPPORTED_LANGUAGES,
        interpolation: { escapeValue: false }
      });
      if (!mounted) return;
      if (!raw || raw !== initialLanguage) {
        await AsyncStorage.setItem(STORAGE_KEY, initialLanguage);
      }
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return null;

  return (
    <I18nextProvider i18n={i18next}>
      <LanguageContextBridge>{children}</LanguageContextBridge>
    </I18nextProvider>
  );
}

export function useLanguage() {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

export type { AppLanguage };
export { SUPPORTED_LANGUAGES };
