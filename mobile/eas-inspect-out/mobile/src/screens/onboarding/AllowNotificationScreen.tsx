import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../localization/LanguageContext";
import { markLaunchSetupComplete } from "../../onboarding/launchSetup";
import type { RootStackParamList } from "../../navigation/RootNavigator";

const GREEN = "#b9f530";
const BG = "#1d2126";

export function AllowNotificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, updateUser } = useAuth();
  const { t, language } = useLanguage();

  const goNext = async () => {
    await updateUser({ preferredLanguage: language });
    if (user?.id != null) {
      await markLaunchSetupComplete(user.id);
    }
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.illustrationWrap}>
        <View style={styles.illustration} />
      </View>
      <Text style={styles.title}>{t("allowNotificationTitle")}</Text>
      <Text style={styles.subtitle}>{t("allowNotificationSubtitle")}</Text>
      <Pressable style={styles.primaryBtn} onPress={goNext}>
        <Text style={styles.primaryText}>{t("allowNotificationBtn")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 18 },
  illustrationWrap: { backgroundColor: "#fff", borderRadius: 8, padding: 14, marginBottom: 14 },
  illustration: { width: "100%", height: 112, backgroundColor: "#f3f4f5", borderRadius: 6 },
  title: { color: GREEN, fontWeight: "900", fontSize: 24, lineHeight: 28 },
  subtitle: { marginTop: 10, color: "#9ca8b1", fontWeight: "600", fontSize: 12, lineHeight: 18 },
  primaryBtn: {
    marginTop: "auto",
    backgroundColor: GREEN,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  primaryText: { color: "#1b1f23", fontWeight: "900", fontSize: 13 }
});
