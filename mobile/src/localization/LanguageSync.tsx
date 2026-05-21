import React from "react";
import { useAuth } from "../auth/AuthContext";
import { useLanguage, type AppLanguage } from "./LanguageContext";
import { SUPPORTED_LANGUAGES } from "./translations";

/** Applies signed-in user's preferred language to global i18n. */
export function LanguageSync() {
  const { user } = useAuth();
  const { setLanguage } = useLanguage();

  React.useEffect(() => {
    const pref = user?.preferredLanguage?.trim();
    if (!pref) return;
    if (!SUPPORTED_LANGUAGES.includes(pref as AppLanguage)) return;
    void setLanguage(pref as AppLanguage);
  }, [user?.preferredLanguage, setLanguage]);

  return null;
}
