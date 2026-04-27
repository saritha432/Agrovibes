import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";

type AppLanguage = "English" | "Hindi" | "Telugu" | "Punjabi" | "Gujarati" | "Bengali" | "Marathi" | "Tamil";

const STORAGE_KEY = "agrovibes.app.language.v1";
const DEFAULT_LANGUAGE: AppLanguage = "English";

const TRANSLATIONS: Record<string, Record<string, string>> = {
  English: {
    getStarted: "Get Started",
    createAccount: "Create Account",
    login: "Login",
    createSubtitle: "Enter details to create your account.",
    loginSubtitle: "Enter mobile number and password to login.",
    name: "Name",
    username: "Username",
    mobilePlaceholder: "Enter mobile number",
    passwordPlaceholder: "Password (min 6)",
    submit: "Submit",
    iHaveAccount: "I already have an account",
    createNewAccount: "Create new account",
    enableLocationTitle: "Enable\nLocation Service",
    enableLocationSubtitle: "Enable your location to discover nearby farms and local opportunities.",
    enableLocationBtn: "Enable Location Service",
    allowNotificationTitle: "Allow\nNotification",
    allowNotificationSubtitle: "Stay updated on crop alerts, market prices and service reminders.",
    allowNotificationBtn: "Turn On Push Notification"
  },
  Hindi: {
    getStarted: "शुरू करें",
    createAccount: "खाता बनाएं",
    login: "लॉगिन",
    createSubtitle: "खाता बनाने के लिए अपनी जानकारी भरें।",
    loginSubtitle: "लॉगिन के लिए मोबाइल नंबर और पासवर्ड दर्ज करें।",
    name: "नाम",
    username: "यूज़रनेम",
    mobilePlaceholder: "मोबाइल नंबर दर्ज करें",
    passwordPlaceholder: "पासवर्ड (कम से कम 6)",
    submit: "सबमिट",
    iHaveAccount: "मेरा पहले से खाता है",
    createNewAccount: "नया खाता बनाएं",
    enableLocationTitle: "लोकेशन\nसर्विस चालू करें",
    enableLocationSubtitle: "पास के फार्म और अवसर देखने के लिए लोकेशन चालू करें।",
    enableLocationBtn: "लोकेशन चालू करें",
    allowNotificationTitle: "नोटिफिकेशन\nचालू करें",
    allowNotificationSubtitle: "फसल अलर्ट, बाजार भाव और रिमाइंडर पाने के लिए नोटिफिकेशन चालू करें।",
    allowNotificationBtn: "पुश नोटिफिकेशन चालू करें"
  },
  Telugu: {
    getStarted: "ప్రారంభించండి",
    createAccount: "ఖాతా సృష్టించండి",
    login: "లాగిన్",
    createSubtitle: "ఖాతా సృష్టించడానికి వివరాలు నమోదు చేయండి.",
    loginSubtitle: "లాగిన్ కోసం మొబైల్ నంబర్ మరియు పాస్‌వర్డ్ నమోదు చేయండి.",
    name: "పేరు",
    username: "యూజర్‌నేమ్",
    mobilePlaceholder: "మొబైల్ నంబర్ నమోదు చేయండి",
    passwordPlaceholder: "పాస్‌వర్డ్ (కనీసం 6)",
    submit: "సబ్మిట్",
    iHaveAccount: "నాకు ఇప్పటికే ఖాతా ఉంది",
    createNewAccount: "కొత్త ఖాతా సృష్టించండి",
    enableLocationTitle: "లోకేషన్\nసర్వీస్ ప్రారంభించండి",
    enableLocationSubtitle: "సమీప వ్యవసాయ అవకాశాలను తెలుసుకోవడానికి లోకేషన్‌ను ప్రారంభించండి.",
    enableLocationBtn: "లోకేషన్ ప్రారంభించండి",
    allowNotificationTitle: "నోటిఫికేషన్\nఅనుమతించండి",
    allowNotificationSubtitle: "పంట అలర్ట్లు, మార్కెట్ ధరలు కోసం నోటిఫికేషన్లు పొందండి.",
    allowNotificationBtn: "పుష్ నోటిఫికేషన్ ఆన్ చేయండి"
  }
};

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: string) => string;
  loading: boolean;
};

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<AppLanguage>(DEFAULT_LANGUAGE);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!mounted) return;
      if (raw) {
        setLanguageState(raw as AppLanguage);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = React.useCallback(async (next: AppLanguage) => {
    setLanguageState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = React.useCallback(
    (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.English?.[key] || key,
    [language]
  );

  const value = React.useMemo(() => ({ language, setLanguage, t, loading }), [language, setLanguage, t, loading]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

export type { AppLanguage };
