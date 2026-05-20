import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

type AppLanguage = "English" | "Hindi" | "Telugu" | "Punjabi" | "Gujarati" | "Bengali" | "Marathi" | "Tamil";

const STORAGE_KEY = "agrovibes.app.language.v1";
const DEFAULT_LANGUAGE: AppLanguage = "English";

const TRANSLATIONS: Record<string, Record<string, string>> = {
  English: {
    getStarted: "Get Started",
    createAccount: "Create Account",
    login: "Login",
    signIn: "Sign In",
    createSubtitle: "Enter details to create your account.",
    loginSubtitle: "Enter mobile number and password to login.",
    name: "Name",
    username: "Username",
    mobilePlaceholder: "Enter mobile number",
    passwordPlaceholder: "Password (min 6)",
    submit: "Submit",
    iHaveAccount: "I already have an account",
    createNewAccount: "Create new account",
    allowNotificationTitle: "Allow\nNotification",
    allowNotificationSubtitle: "Stay updated on crop alerts, market prices and service reminders.",
    allowNotificationBtn: "Turn On Push Notification",
    forgotPassword: "Forgot password",
    forgotPasswordSubtitle: "Reset your password using OTP",
    forgotPasswordLink: "Forgot password?",
    enterPhone: "Enter your mobile number",
    sendOtp: "Send OTP",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    resetPassword: "Reset Password",
    onboardingBrandTitle: "CROPVIBE",
    onboardingBrandSubtitle: "Your Field, Your Future",
    onboardingSlide3Tag: "Media",
    onboardingSlide3Title: "Share Your\nFarming Journey",
    onboardingSlide3Subtitle: "Post reels, showcase your products, and learn from other farmers across the community.",
    onboardingSlide4Tag: "Marketplace",
    onboardingSlide4Title: "Buy & Sell With Ease",
    onboardingSlide4Subtitle: "Get the best price for your crops or shop for seeds, tools, and equipment all in one place.",
    onboardingSlide5Tag: "Community",
    onboardingSlide5Title: "Grow Together",
    onboardingSlide5Subtitle: "Connect with farmers, buyers, and experts—ask questions, share knowledge, and support each other.",
    onboardingSlide6Tag: "Education",
    onboardingSlide6Title: "Learn Modern Farming",
    onboardingSlide6Subtitle: "Explore expert tips, smart techniques, and short learning videos to improve productivity.",
    onboardingSlide7Tag: "Logistics",
    onboardingSlide7Title: "Reliable Farm Delivery",
    onboardingSlide7Subtitle: "Move your produce faster with trusted transport and doorstep pickup services.",
    onboardingAllDoneTag: "All Done!!",
    onboardingAllDoneTitle: "Reliable Farm Delivery",
    onboardingAllDoneSubtitle: "Move your produce faster with trusted transport and doorstep pickup services.",
    editProfile: "Edit Profile",
    share: "Share",
    shareProfileTitle: "Agrovibes Profile",
    shareProfileJoinLine: "Join me on Agrovibes.",
    shareProfileError: "Could not open share options right now."
  },
  Hindi: {
    getStarted: "शुरू करें",
    createAccount: "खाता बनाएं",
    login: "लॉगिन",
    signIn: "साइन इन",
    createSubtitle: "खाता बनाने के लिए अपनी जानकारी भरें।",
    loginSubtitle: "लॉगिन के लिए मोबाइल नंबर और पासवर्ड दर्ज करें।",
    name: "नाम",
    username: "यूज़रनेम",
    mobilePlaceholder: "मोबाइल नंबर दर्ज करें",
    passwordPlaceholder: "पासवर्ड (कम से कम 6)",
    submit: "सबमिट",
    iHaveAccount: "मेरा पहले से खाता है",
    createNewAccount: "नया खाता बनाएं",
    allowNotificationTitle: "नोटिफिकेशन\nचालू करें",
    allowNotificationSubtitle: "फसल अलर्ट, बाजार भाव और रिमाइंडर पाने के लिए नोटिफिकेशन चालू करें।",
    allowNotificationBtn: "पुश नोटिफिकेशन चालू करें",
    forgotPassword: "पासवर्ड भूल गए",
    forgotPasswordSubtitle: "OTP से पासवर्ड रीसेट करें",
    forgotPasswordLink: "पासवर्ड भूल गए?",
    enterPhone: "अपना मोबाइल नंबर दर्ज करें",
    sendOtp: "OTP भेजें",
    newPassword: "नया पासवर्ड",
    confirmPassword: "पासवर्ड पुष्टि करें",
    resetPassword: "पासवर्ड रीसेट करें",
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
    onboardingSlide8Subtitle: "अब आपकी उपज सुरक्षित और तेज़ी से बाज़ार तक पहुंचेगी।",
    onboardingAllDoneTag: "सब हो गया!!",
    onboardingAllDoneTitle: "विश्वसनीय फार्म डिलीवरी",
    onboardingAllDoneSubtitle: "विश्वसनीय परिवहन और घर पर पिकअप सेवाओं के साथ अपनी उपज तेज़ी से पहुँचाएं।",
    editProfile: "प्रोफाइल संपादित करें",
    share: "शेयर",
    shareProfileTitle: "एग्रोवाइब्स प्रोफाइल",
    shareProfileJoinLine: "मुझसे एग्रोवाइब्स पर जुड़ें।",
    shareProfileError: "अभी शेयर विकल्प नहीं खुल सके।"
  },
  Telugu: {
    getStarted: "ప్రారంభించండి",
    createAccount: "ఖాతా సృష్టించండి",
    login: "లాగిన్",
    signIn: "సైన్ ఇన్",
    createSubtitle: "ఖాతా సృష్టించడానికి వివరాలు నమోదు చేయండి.",
    loginSubtitle: "లాగిన్ కోసం మొబైల్ నంబర్ మరియు పాస్‌వర్డ్ నమోదు చేయండి.",
    name: "పేరు",
    username: "యూజర్‌నేమ్",
    mobilePlaceholder: "మొబైల్ నంబర్ నమోదు చేయండి",
    passwordPlaceholder: "పాస్‌వర్డ్ (కనీసం 6)",
    submit: "సబ్మిట్",
    iHaveAccount: "నాకు ఇప్పటికే ఖాతా ఉంది",
    createNewAccount: "కొత్త ఖాతా సృష్టించండి",
    allowNotificationTitle: "నోటిఫికేషన్\nఅనుమతించండి",
    allowNotificationSubtitle: "పంట అలర్ట్లు, మార్కెట్ ధరలు కోసం నోటిఫికేషన్లు పొందండి.",
    allowNotificationBtn: "పుష్ నోటిఫికేషన్ ఆన్ చేయండి",
    forgotPassword: "పాస్‌వర్డ్ మర్చిపోయారా",
    forgotPasswordSubtitle: "OTP తో పాస్‌వర్డ్ రీసెట్ చేయండి",
    forgotPasswordLink: "పాస్‌వర్డ్ మర్చిపోయారా?",
    enterPhone: "మీ మొబైల్ నంబర్ నమోదు చేయండి",
    sendOtp: "OTP పంపండి",
    newPassword: "కొత్త పాస్‌వర్డ్",
    confirmPassword: "పాస్‌వర్డ్ నిర్ధారించండి",
    resetPassword: "పాస్‌వర్డ్ రీసెట్ చేయండి",
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
    onboardingSlide8Subtitle: "ఇప్పుడు మీ ఉత్పత్తి సురక్షితంగా, వేగంగా మార్కెట్‌కు చేరుతుంది.",
    onboardingAllDoneTag: "అంతా పూర్తైంది!!",
    onboardingAllDoneTitle: "నమ్మకమైన ఫారం డెలివరీ",
    onboardingAllDoneSubtitle: "నమ్మకమైన రవాణా మరియు డోర్‌స్టెప్ పికప్ సేవలతో మీ ఉత్పత్తిని వేగంగా తరలించండి.",
    editProfile: "ప్రొఫైల్ ఎడిట్ చేయండి",
    share: "షేర్",
    shareProfileTitle: "అగ్రోవైబ్స్ ప్రొఫైల్",
    shareProfileJoinLine: "అగ్రోవైబ్స్‌లో నాతో కనెక్ట్ అవ్వండి.",
    shareProfileError: "ఇప్పుడు షేర్ ఆప్షన్లు తెరవలేకపోయాము."
  }
};

const I18N_RESOURCES = {
  English: { translation: TRANSLATIONS.English },
  Hindi: { translation: TRANSLATIONS.Hindi },
  Telugu: { translation: TRANSLATIONS.Telugu }
} as const;

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
      const saved = raw as AppLanguage | null;
      const initialLanguage = saved && I18N_RESOURCES[saved as keyof typeof I18N_RESOURCES] ? saved : DEFAULT_LANGUAGE;
      await i18next.use(initReactI18next).init({
        resources: I18N_RESOURCES,
        lng: initialLanguage,
        fallbackLng: DEFAULT_LANGUAGE,
        interpolation: { escapeValue: false }
      });
      if (!mounted) return;
      setLanguageState(initialLanguage);
      if (!raw || raw !== initialLanguage) {
        await AsyncStorage.setItem(STORAGE_KEY, initialLanguage);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = React.useCallback(async (next: AppLanguage) => {
    if (!I18N_RESOURCES[next as keyof typeof I18N_RESOURCES]) return;
    await i18next.changeLanguage(next);
    setLanguageState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = React.useCallback(
    (key: string) => i18next.t(key, { defaultValue: TRANSLATIONS.English?.[key] || key }),
    []
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
