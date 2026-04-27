import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useLanguage } from "../../localization/LanguageContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";

const GREEN = "#b9f530";
const BG = "#1d2126";

export function EnableLocationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();

  return (
    <View style={styles.screen}>
      <View style={styles.illustration} />
      <Text style={styles.title}>{t("enableLocationTitle")}</Text>
      <Text style={styles.subtitle}>{t("enableLocationSubtitle")}</Text>
      <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate("AllowNotification")}>
        <Text style={styles.primaryText}>{t("enableLocationBtn")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 18 },
  illustration: {
    width: "100%",
    height: 138,
    borderRadius: 8,
    backgroundColor: "#4a4f56",
    marginBottom: 18
  },
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
