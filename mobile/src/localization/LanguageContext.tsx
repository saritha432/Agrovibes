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
    allowNotificationBtn: "Turn On Push Notification",
    onboardingBrandTitle: "CROPVIBE",
    onboardingBrandSubtitle: "Your Field, Your Future",
    onboardingSlide3Tag: "Discover",
    onboardingSlide3Title: "Share Your\nFarming Journey",
    onboardingSlide3Subtitle: "Post daily updates, discuss crop health, and connect with farmers across the community.",
    onboardingSlide4Tag: "Marketplace",
    onboardingSlide4Title: "Buy & Sell With Ease",
    onboardingSlide4Subtitle: "Sell your farm produce and reach buyers directly for better prices and simple deals.",
    onboardingSlide5Tag: "Community",
    onboardingSlide5Title: "Grow Together",
    onboardingSlide5Subtitle: "Collaborate with nearby farmers, ask expert questions, and share practical advice.",
    onboardingSlide6Tag: "Education",
    onboardingSlide6Title: "Learn Modern Farming",
    onboardingSlide6Subtitle: "Explore expert tips, smart techniques, and short learning videos to improve productivity.",
    onboardingSlide7Tag: "Logistics",
    onboardingSlide7Title: "Reliable Farm Delivery",
    onboardingSlide7Subtitle: "Track your produce shipments from source to market through trusted transport options.",
    onboardingSlide8Tag: "Logistics",
    onboardingSlide8Title: "Reliable Farm Delivery",
    onboardingSlide8Subtitle: "Now Your Produce Reaches Market Securely And Quickly Without Hassle."
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
    allowNotificationBtn: "पुश नोटिफिकेशन चालू करें",
    onboardingBrandTitle: "क्रॉपवाइब",
    onboardingBrandSubtitle: "आपका खेत, आपका भविष्य",
    onboardingSlide3Tag: "खोज",
    onboardingSlide3Title: "अपनी\nखेती यात्रा साझा करें",
    onboardingSlide3Subtitle: "रोज़ाना अपडेट पोस्ट करें, फसल स्वास्थ्य पर चर्चा करें और किसानों से जुड़ें।",
    onboardingSlide4Tag: "मार्केटप्लेस",
    onboardingSlide4Title: "आसानी से खरीदें और बेचें",
    onboardingSlide4Subtitle: "अपनी उपज सीधे खरीदारों तक बेचें और बेहतर दाम पाएं।",
    onboardingSlide5Tag: "समुदाय",
    onboardingSlide5Title: "मिलकर आगे बढ़ें",
    onboardingSlide5Subtitle: "आसपास के किसानों के साथ जुड़ें, सवाल पूछें और सलाह साझा करें।",
    onboardingSlide6Tag: "शिक्षा",
    onboardingSlide6Title: "आधुनिक खेती सीखें",
    onboardingSlide6Subtitle: "विशेषज्ञ टिप्स और तकनीकों से अपनी उत्पादकता बढ़ाएं।",
    onboardingSlide7Tag: "लॉजिस्टिक्स",
    onboardingSlide7Title: "विश्वसनीय फार्म डिलीवरी",
    onboardingSlide7Subtitle: "अपनी उपज की डिलीवरी स्रोत से बाज़ार तक आसानी से ट्रैक करें।",
    onboardingSlide8Tag: "लॉजिस्टिक्स",
    onboardingSlide8Title: "विश्वसनीय फार्म डिलीवरी",
    onboardingSlide8Subtitle: "अब आपकी उपज सुरक्षित और तेज़ी से बाज़ार तक पहुंचेगी।"
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
    allowNotificationBtn: "పుష్ నోటిఫికేషన్ ఆన్ చేయండి",
    onboardingBrandTitle: "క్రాప్‌వైబ్",
    onboardingBrandSubtitle: "మీ పొలం, మీ భవిష్యత్తు",
    onboardingSlide3Tag: "కనుగొను",
    onboardingSlide3Title: "మీ\nవ్యవసాయ ప్రయాణాన్ని పంచుకోండి",
    onboardingSlide3Subtitle: "రోజువారీ అప్‌డేట్లు పెట్టండి, పంట ఆరోగ్యంపై చర్చించండి, రైతులతో కలవండి.",
    onboardingSlide4Tag: "మార్కెట్‌ప్లేస్",
    onboardingSlide4Title: "సులభంగా కొనండి & అమ్మండి",
    onboardingSlide4Subtitle: "మీ పంటను నేరుగా కొనుగోలుదారులకు అమ్మి మంచి ధర పొందండి.",
    onboardingSlide5Tag: "సమూహం",
    onboardingSlide5Title: "కలిసి అభివృద్ధి చెందండి",
    onboardingSlide5Subtitle: "సమీప రైతులతో కలసి నిపుణుల సలహాలు పొందండి.",
    onboardingSlide6Tag: "విద్య",
    onboardingSlide6Title: "ఆధునిక వ్యవసాయం నేర్చుకోండి",
    onboardingSlide6Subtitle: "నిపుణుల చిట్కాలు, పద్ధతులతో దిగుబడిని మెరుగుపరుచుకోండి.",
    onboardingSlide7Tag: "లాజిస్టిక్స్",
    onboardingSlide7Title: "నమ్మకమైన ఫారం డెలివరీ",
    onboardingSlide7Subtitle: "మీ ఉత్పత్తి రవాణాను మూలం నుంచి మార్కెట్ వరకు ట్రాక్ చేయండి.",
    onboardingSlide8Tag: "లాజిస్టిక్స్",
    onboardingSlide8Title: "నమ్మకమైన ఫారం డెలివరీ",
    onboardingSlide8Subtitle: "ఇప్పుడు మీ ఉత్పత్తి సురక్షితంగా, వేగంగా మార్కెట్‌కు చేరుతుంది."
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
