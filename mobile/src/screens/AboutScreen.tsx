import React from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useLanguage } from "../localization/LanguageContext";
import Constants from "expo-constants";
import { APP_BLACK, APP_LIME, APP_SURFACE } from "../theme/appColors";

const BG = APP_BLACK;
const LIME = APP_LIME;
const CARD = APP_SURFACE;
const TEXT = "#f0f4f8";
const MUTED = "#97a0a8";

const APP_VERSION = Constants.expoConfig?.version ?? "1.0.1";

export function AboutScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { t } = useLanguage();

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={styles.topTitle}>{t("about") || "About"}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={36} color={LIME} />
          </View>
          <Text style={styles.appName}>Cropvibe</Text>
          <Text style={styles.version}>Version {APP_VERSION}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Us</Text>
          <Text style={styles.aboutText}>
            Cropvibe connects farmers, buyers, and agricultural experts on a single platform. 
            Share knowledge, trade produce, learn modern farming techniques, and grow together 
            as a community.
          </Text>
        </View>

        <View style={styles.section}>
          <Pressable style={styles.menuItem} onPress={() => Linking.openURL("https://cropvibe.com/terms")}>
            <Ionicons name="document-text-outline" size={20} color={LIME} />
            <Text style={styles.menuItemText}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={16} color={MUTED} />
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => Linking.openURL("https://cropvibe.com/privacy")}>
            <Ionicons name="shield-outline" size={20} color={LIME} />
            <Text style={styles.menuItemText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={16} color={MUTED} />
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => Linking.openURL("https://cropvibe.com")}>
            <Ionicons name="globe-outline" size={20} color={LIME} />
            <Text style={styles.menuItemText}>Website</Text>
            <Ionicons name="chevron-forward" size={16} color={MUTED} />
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => Linking.openURL("mailto:support@cropvibe.com")}>
            <Ionicons name="mail-outline" size={20} color={LIME} />
            <Text style={styles.menuItemText}>Contact Us</Text>
            <Ionicons name="chevron-forward" size={16} color={MUTED} />
          </Pressable>
        </View>

        <Text style={styles.footer}>Made with love for Indian farmers</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#262d35"
  },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  topTitle: { color: TEXT, fontSize: 18, fontWeight: "900", textTransform: "capitalize" },
  content: { padding: 16, paddingBottom: 60 },
  logoSection: { alignItems: "center", paddingVertical: 28 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1a2028",
    borderWidth: 2,
    borderColor: LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  appName: { color: TEXT, fontSize: 22, fontWeight: "900", marginTop: 12 },
  version: { color: MUTED, fontSize: 13, fontWeight: "600", marginTop: 4 },
  section: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#303842",
    padding: 14,
    marginBottom: 16
  },
  sectionTitle: { color: MUTED, fontSize: 12, fontWeight: "800", marginBottom: 8 },
  aboutText: { color: TEXT, fontSize: 13, fontWeight: "600", lineHeight: 20 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    gap: 12
  },
  menuItemText: { color: TEXT, fontSize: 14, fontWeight: "700", flex: 1 },
  footer: { color: MUTED, fontSize: 11, fontWeight: "600", textAlign: "center", marginTop: 10 }
});
