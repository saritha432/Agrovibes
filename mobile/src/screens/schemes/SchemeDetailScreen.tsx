import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getGovSchemeById, type GovScheme } from "../../data/govSchemes";
import { useLanguage } from "../../localization/LanguageContext";
import type { RootStackParamList } from "../../navigation/rootStackTypes";
import { useAndroidScreenBack } from "../../navigation/useAndroidScreenBack";
import { APP_DARK_BG, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED, APP_TEXT_ON_LIME } from "../../theme/appColors";
import { readSavedSchemeIds, writeSavedSchemeIds } from "./schemeStore";

export function SchemeDetailView({
  scheme,
  onBack
}: {
  scheme: GovScheme;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void readSavedSchemeIds().then((ids) => setSaved(ids.includes(scheme.id)));
  }, [scheme.id]);

  const toggleSaved = useCallback(async () => {
    const ids = await readSavedSchemeIds();
    const next = saved ? ids.filter((id) => id !== scheme.id) : [...ids, scheme.id];
    await writeSavedSchemeIds(next);
    setSaved(!saved);
  }, [saved, scheme.id]);

  const openOfficialSite = useCallback(async () => {
    try {
      await Linking.openURL(scheme.officialUrl);
    } catch {
      Alert.alert(t("schemesOpenFailed"));
    }
  }, [scheme.officialUrl, t]);

  const checkEligible = useCallback(() => {
    Alert.alert(t("schemesEligibilityTitle"), `${scheme.whoFor}\n\n${t("schemesEligibilityHint")}`, [
      { text: t("schemesOfficialSite"), onPress: () => void openOfficialSite() },
      { text: "OK", style: "cancel" }
    ]);
  }, [openOfficialSite, scheme.whoFor, t]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.head}>
        <Pressable onPress={onBack} style={styles.back} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </Pressable>
        <Pressable onPress={() => void toggleSaved()} style={styles.back} hitSlop={10} accessibilityLabel={t("schemesSave")}>
          <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={22} color={APP_LIME} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.kicker}>{scheme.categoryLabel.toUpperCase()}</Text>
        <Text style={styles.title}>{scheme.name}</Text>
        <Text style={styles.lead}>{scheme.description}</Text>
        <Text style={styles.bullet}>
          <Text style={styles.bulletLabel}>{t("schemesWhoFor")}: </Text>
          {scheme.whoFor}
        </Text>
        <Text style={styles.bullet}>
          <Text style={styles.bulletLabel}>{t("schemesDocuments")}: </Text>
          {scheme.documents}
        </Text>
        {scheme.note ? <Text style={styles.note}>{scheme.note}</Text> : null}
        <View style={styles.actions}>
          <Pressable style={styles.primary} onPress={checkEligible}>
            <Text style={styles.primaryText}>{t("schemesCheckEligible")}</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => void openOfficialSite()}>
            <Text style={styles.secondaryText}>{t("schemesOfficialSite")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function SchemeDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "SchemeDetail">>();
  const { t } = useLanguage();
  const scheme = getGovSchemeById(String(route.params?.schemeId || ""));

  useAndroidScreenBack(
    useCallback(() => {
      navigation.goBack();
      return true;
    }, [navigation])
  );

  if (!scheme) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <StatusBar barStyle="light-content" />
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </Pressable>
        <Text style={styles.empty}>{t("schemesEmpty")}</Text>
      </SafeAreaView>
    );
  }

  return <SchemeDetailView scheme={scheme} onBack={() => navigation.goBack()} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: APP_DARK_BG },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8
  },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { color: APP_TEXT_MUTED, padding: 20 },
  kicker: { color: APP_TEXT_MUTED, fontSize: 12, fontWeight: "800", letterSpacing: 0.6, marginTop: 8 },
  title: { fontSize: 26, fontWeight: "800", color: APP_TEXT, marginTop: 8, marginBottom: 12 },
  lead: { color: APP_TEXT_MUTED, fontSize: 16, lineHeight: 24, marginBottom: 18 },
  bullet: { color: APP_TEXT, fontSize: 15, lineHeight: 22, marginBottom: 10 },
  bulletLabel: { fontWeight: "800" },
  note: { color: APP_TEXT_MUTED, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 22 },
  actions: { gap: 10, marginTop: 8 },
  primary: {
    backgroundColor: APP_LIME,
    borderRadius: 22,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  primaryText: { color: APP_TEXT_ON_LIME, fontWeight: "700", fontSize: 15 },
  secondary: {
    borderRadius: 22,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#4a4a4a",
    backgroundColor: APP_SURFACE
  },
  secondaryText: { color: APP_TEXT, fontWeight: "700", fontSize: 15 }
});
