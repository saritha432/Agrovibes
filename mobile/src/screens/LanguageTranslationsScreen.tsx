import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_MUTED, APP_SURFACE } from "../theme/appColors";
import { useLanguage } from "../localization/LanguageContext";
import type { AppLanguage } from "../localization/LanguageContext";

const PREFS_KEY = "agrovibes.language-translations-prefs.v1";
const DIVIDER = "rgba(255,255,255,0.08)";

const LANGUAGE_OPTIONS: Array<{ value: AppLanguage; nativeLabel: string }> = [
  { value: "English", nativeLabel: "English" },
  { value: "Hindi", nativeLabel: "हिन्दी" },
  { value: "Telugu", nativeLabel: "తెలుగు" },
  { value: "Kannada", nativeLabel: "ಕನ್ನಡ" },
  { value: "Malayalam", nativeLabel: "മലയാളം" },
  { value: "Tamil", nativeLabel: "தமிழ்" },
  { value: "Marathi", nativeLabel: "मराठी" },
  { value: "Bengali", nativeLabel: "বাংলা" }
];

type TranslatePrefs = {
  preferredLanguages: boolean;
  translatePosts: boolean;
  translateVoice: boolean;
};

const DEFAULT_PREFS: TranslatePrefs = {
  preferredLanguages: false,
  translatePosts: false,
  translateVoice: false
};

export function LanguageTranslationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { language, setLanguage } = useLanguage();
  const [prefs, setPrefs] = useState<TranslatePrefs>(DEFAULT_PREFS);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(PREFS_KEY);
        if (!mounted || !raw) return;
        const parsed = JSON.parse(raw) as Partial<TranslatePrefs>;
        setPrefs({ ...DEFAULT_PREFS, ...parsed });
      } catch {
        // ignore malformed cache
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const updatePrefs = async (patch: Partial<TranslatePrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  };

  const selectedLanguage = useMemo(() => LANGUAGE_OPTIONS.find((o) => o.value === language)?.value ?? "English", [language]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={APP_LIME} />
        </Pressable>
        <Text style={styles.topTitle}>Language And Translations</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View>
              <Text style={styles.cardTitle}>App Language</Text>
              <Text style={styles.cardSub}>Choose your preferred language for cropvibe.</Text>
            </View>
            <View style={styles.setLanguagePill}>
              <Text style={styles.setLanguageText}>Set Language</Text>
            </View>
          </View>

          {LANGUAGE_OPTIONS.map((opt, index) => {
            const active = selectedLanguage === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.langRow, index < LANGUAGE_OPTIONS.length - 1 ? styles.langRowDivider : null]}
                onPress={() => void setLanguage(opt.value)}
              >
                <Text style={styles.langText}>{opt.nativeLabel}</Text>
                {active ? (
                  <Ionicons name="checkmark-circle" size={20} color={APP_LIME} />
                ) : (
                  <View style={styles.uncheckedBox} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* hidden for now as requested */}
        {/* <View style={styles.card}>
          <Text style={styles.sectionHeading}>Content Translation</Text>
          <ToggleRow
            title="Preferred Languages"
            subtitle="Select the languages you'd like content translated into."
            value={prefs.preferredLanguages}
            onValueChange={(v) => void updatePrefs({ preferredLanguages: v })}
          />
          <ToggleRow
            title="Translate Posts"
            subtitle="Automatically translate captions and post descriptions when available."
            value={prefs.translatePosts}
            onValueChange={(v) => void updatePrefs({ translatePosts: v })}
          />
          <ToggleRow
            title="Translate Voice"
            subtitle="Translate spoken audio into your preferred language when supported."
            value={prefs.translateVoice}
            onValueChange={(v) => void updatePrefs({ translateVoice: v })}
            noDivider
          />
        </View> */}
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  noDivider
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  noDivider?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, !noDivider ? styles.toggleDivider : null]}>
      <View style={styles.toggleBody}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSub}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: "#4d5259", true: APP_LIME }} thumbColor="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_BLACK },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { color: APP_TEXT, fontSize: 16, fontWeight: "700" },
  content: { padding: 10, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: APP_SURFACE,
    borderWidth: 1,
    borderColor: DIVIDER,
    borderRadius: 12,
    overflow: "hidden"
  },
  cardHead: {
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  cardTitle: { color: APP_TEXT, fontSize: 16, fontWeight: "700" },
  cardSub: { color: APP_TEXT_MUTED, fontSize: 11, marginTop: 2 },
  setLanguagePill: {
    minHeight: 22,
    borderRadius: 6,
    backgroundColor: "rgba(201,255,53,0.18)",
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  setLanguageText: { color: APP_LIME, fontSize: 10, fontWeight: "700" },
  langRow: {
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  langRowDivider: { borderBottomWidth: 1, borderBottomColor: DIVIDER },
  langText: { color: APP_TEXT, fontSize: 14, fontWeight: "600" },
  uncheckedBox: { width: 14, height: 14, borderWidth: 1.2, borderColor: "rgba(255,255,255,0.35)", borderRadius: 2 },
  sectionHeading: { color: APP_TEXT_MUTED, fontSize: 13, fontWeight: "700", paddingHorizontal: 12, paddingVertical: 10 },
  toggleRow: {
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  toggleDivider: { borderTopWidth: 1, borderTopColor: DIVIDER },
  toggleBody: { flex: 1, paddingRight: 8 },
  toggleTitle: { color: APP_TEXT, fontSize: 15, fontWeight: "600" },
  toggleSub: { color: APP_TEXT_MUTED, fontSize: 11, marginTop: 3, lineHeight: 15 }
});
