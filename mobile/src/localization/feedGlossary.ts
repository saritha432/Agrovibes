import type { AppLanguage } from "./translations";

type Gloss = { hi: string; te: string };

/** Meaningful Hindi/Telugu words — not phonetic transliteration. */
export const FEED_GLOSSARY: Record<string, Gloss> = {
  // Fruits & produce
  mango: { hi: "आम", te: "మామిడి" },
  mangoes: { hi: "आम", te: "మామిడి" },
  mamidi: { hi: "आम", te: "మామిడి" },
  banana: { hi: "केला", te: "అరటి" },
  bananas: { hi: "केले", te: "అరటిపండ్లు" },
  rice: { hi: "चावल", te: "బియ్యం" },
  wheat: { hi: "गेहूं", te: "గోధుమ" },
  cotton: { hi: "कपास", te: "పత్తి" },
  chilli: { hi: "मिर्च", te: "మిరప" },
  chilies: { hi: "मिर्च", te: "మిరపకాయలు" },
  chili: { hi: "मिर्च", te: "మిరప" },
  tomato: { hi: "टमाटर", te: "టమాటా" },
  tomatoes: { hi: "टमाटर", te: "టమాటాలు" },
  onion: { hi: "प्याज", te: "ఉల్లి" },
  onions: { hi: "प्याज", te: "ఉల్లిపాయలు" },
  potato: { hi: "आलू", te: "బంగాళాదుంప" },
  potatoes: { hi: "आलू", te: "బంగాళాదుంపలు" },
  corn: { hi: "मक्का", te: "మొక్కజొన్న" },
  maize: { hi: "मक्का", te: "మొక్కజొన్న" },
  groundnut: { hi: "मूंगफली", te: "వేరుశనగ" },
  peanuts: { hi: "मूंगफली", te: "వేరుశనగలు" },
  coconut: { hi: "नारियल", te: "కొబ్బరి" },
  coconuts: { hi: "नारियल", te: "కొబ్బరికాయలు" },
  lemon: { hi: "नींबू", te: "నిమ్మ" },
  lemons: { hi: "नींबू", te: "నిమ్మకాయలు" },
  orange: { hi: "संतरा", te: "నారింజ" },
  oranges: { hi: "संतरे", te: "నారింజపండ్లు" },
  grape: { hi: "अंगूर", te: "ద్రాక్ష" },
  grapes: { hi: "अंगूर", te: "ద్రాక్షపండ్లు" },
  apple: { hi: "सेब", te: "ఆపిల్" },
  apples: { hi: "सेब", te: "ఆపిల్స్" },
  papaya: { hi: "पपीता", te: "బొప్పాయి" },
  watermelon: { hi: "तरबूज", te: "పుచ్చకాయ" },

  // Farming & market
  farm: { hi: "खेत", te: "పొలం" },
  farming: { hi: "खेती", te: "వ్యవసాయం" },
  farmer: { hi: "किसान", te: "రైతు" },
  farmers: { hi: "किसान", te: "రైతులు" },
  crop: { hi: "फसल", te: "పంట" },
  crops: { hi: "फसलें", te: "పంటలు" },
  harvest: { hi: "फसल कटाई", te: "పంట కోత" },
  field: { hi: "खेत", te: "పొలం" },
  soil: { hi: "मिट्टी", te: "నేల" },
  seed: { hi: "बीज", te: "విత్తనం" },
  seeds: { hi: "बीज", te: "విత్తనాలు" },
  fertilizer: { hi: "उर्वरक", te: "ఎరువు" },
  pesticide: { hi: "कीटनाशक", te: "పురుగుమందు" },
  irrigation: { hi: "सिंचाई", te: "నీటిపారుదల" },
  market: { hi: "बाजार", te: "మార్కెట్" },
  price: { hi: "कीमत", te: "ధర" },
  prices: { hi: "कीमतें", te: "ధరలు" },
  sell: { hi: "बेचें", te: "అమ్మండి" },
  buy: { hi: "खरीदें", te: "కొనండి" },
  organic: { hi: "जैविक", te: "సేంద్రీయ" },

  // Common post / reel words
  test: { hi: "परीक्षण", te: "పరీక్ష" },
  testing: { hi: "परीक्षण", te: "పరీక్ష" },
  mobile: { hi: "मोबाइल", te: "మొబైల్" },
  app: { hi: "ऐप", te: "యాప్" },
  camera: { hi: "कैमरा", te: "కెమెరా" },
  from: { hi: "से", te: "నుండి" },
  video: { hi: "वीडियो", te: "వీడియో" },
  photo: { hi: "फोटो", te: "ఫోటో" },
  reel: { hi: "रील", te: "రీల్" },
  reels: { hi: "रील", te: "రీల్స్" },
  story: { hi: "कहानी", te: "స్టోరీ" },
  live: { hi: "लाइव", te: "లైవ్" },
  learn: { hi: "सीखें", te: "నేర్చుకోండి" },
  community: { hi: "समुदाय", te: "సమాజం" },
  logistics: { hi: "लॉजिस्टिक्स", te: "లాజిస్టిక్స్" },
  original: { hi: "मूल", te: "అసలు" },
  audio: { hi: "ऑडियो", te: "ఆడియో" },
  capture: { hi: "रिकॉर्डिंग", te: "రికార్డింగ్" },
  green: { hi: "हरा", te: "ఆకుపచ్చ" },
  fresh: { hi: "ताजा", te: "తాజా" },
  today: { hi: "आज", te: "ఈరోజు" },
  morning: { hi: "सुबह", te: "ఉదయం" },
  evening: { hi: "शाम", te: "సాయంత్రం" },
  welcome: { hi: "स्वागत", te: "స్వాగతం" },
  hello: { hi: "नमस्ते", te: "నమస్కారం" },
  thanks: { hi: "धन्यवाद", te: "ధన్యవాదాలు" },
  thank: { hi: "धन्यवाद", te: "ధన్యవాదాలు" },
  you: { hi: "आप", te: "మీరు" }
};

/** Multi-word phrases (checked before single words). Longest keys first at runtime. */
export const FEED_PHRASE_GLOSSARY: Record<string, Gloss> = {
  "test video capture": { hi: "परीक्षण वीडियो रिकॉर्डिंग", te: "పరీక్ష వీడియో రికార్డింగ్" },
  "testing from mobile app camera": {
    hi: "मोबाइल ऐप कैमरा से परीक्षण",
    te: "మొబైల్ యాప్ కెమెరా నుండి పరీక్ష"
  },
  "original audio": { hi: "मूल ऑडियो", te: "అసలు ఆడియో" },
  "green farm": { hi: "हरा खेत", te: "ఆకుపచ్చ పొలం" },
  "fresh mangoes": { hi: "ताजे आम", te: "తాజా మామిడి" },
  "organic farming": { hi: "जैविक खेती", te: "సేంద్రీయ వ్యవసాయం" },
  "crop market": { hi: "फसल बाजार", te: "పంట మార్కెట్" }
};

function glossaryFor(language: AppLanguage): "hi" | "te" | null {
  if (language === "Hindi") return "hi";
  if (language === "Telugu") return "te";
  return null;
}

function lookupWord(word: string, lang: "hi" | "te"): string | null {
  const entry = FEED_GLOSSARY[word.toLowerCase()];
  return entry ? entry[lang] : null;
}

function lookupPhrase(phrase: string, lang: "hi" | "te"): string | null {
  const entry = FEED_PHRASE_GLOSSARY[phrase.toLowerCase()];
  return entry ? entry[lang] : null;
}

/** Replace known English words/phrases with real Hindi/Telugu meanings. */
export function translateFeedGlossary(text: string, language: AppLanguage): string {
  const lang = glossaryFor(language);
  if (!lang || !text.trim()) return text;

  const phraseKeys = Object.keys(FEED_PHRASE_GLOSSARY).sort((a, b) => b.length - a.length);
  let out = text;
  for (const phrase of phraseKeys) {
    const translated = lookupPhrase(phrase, lang);
    if (!translated) continue;
    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    if (re.test(out)) out = out.replace(re, translated);
  }

  return out.replace(/\b[a-zA-Z]+\b/g, (word) => lookupWord(word, lang) ?? word);
}
