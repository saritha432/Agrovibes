import React from "react";
import { Linking, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { useLanguage, SUPPORTED_LANGUAGES } from "../localization/LanguageContext";
import { APP_BLACK, APP_LIME, APP_SURFACE } from "../theme/appColors";

const BG = APP_BLACK;
const LIME = APP_LIME;
const CARD = APP_SURFACE;
const TEXT = "#f0f4f8";
const MUTED = "#97a0a8";

export function SettingsMenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const topPadding = Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 0;

  return (
    <View style={[styles.screen, { paddingTop: topPadding }]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={TEXT} />
        </Pressable>
        <Text style={styles.topTitle}>{t("settings") || "Settings"}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Pressable style={styles.menuItem} onPress={() => { navigation.goBack(); }}>
            <View style={styles.menuIconWrap}>
              <Ionicons name="notifications-outline" size={22} color={LIME} />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemText}>{t("notifications") || "Notifications"}</Text>
              <Text style={styles.menuItemSub}>{t("manageAlerts") || "Manage push & in-app alerts"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={MUTED} />
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => navigation.navigate("EditProfile")}>
            <View style={styles.menuIconWrap}>
              <Ionicons name="person-outline" size={22} color={LIME} />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemText}>{t("editProfile") || "Edit Profile"}</Text>
              <Text style={styles.menuItemSub}>{t("updateProfile") || "Update name, photo & bio"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={MUTED} />
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => { navigation.goBack(); setTimeout(() => navigation.navigate("Main", { screen: "Profile", params: { initialTab: "Saved" } } as any), 100); }}>
            <View style={styles.menuIconWrap}>
              <Ionicons name="bookmark-outline" size={22} color={LIME} />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemText}>{t("saved") || "Saved"}</Text>
              <Text style={styles.menuItemSub}>{t("viewSavedPosts") || "View your saved posts"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={MUTED} />
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => navigation.navigate("Privacy")}>
            <View style={styles.menuIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={22} color={LIME} />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemText}>{t("privacy") || "Privacy"}</Text>
              <Text style={styles.menuItemSub}>{t("privacySub") || "Control who can see your content"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={MUTED} />
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => Linking.openURL("mailto:support@cropvibe.com")}>
            <View style={styles.menuIconWrap}>
              <Ionicons name="help-circle-outline" size={22} color={LIME} />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemText}>{t("helpSupport") || "Help & Support"}</Text>
              <Text style={styles.menuItemSub}>{t("helpSupportSub") || "Contact us or report an issue"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={MUTED} />
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => navigation.navigate("About")}>
            <View style={styles.menuIconWrap}>
              <Ionicons name="information-circle-outline" size={22} color={LIME} />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemText}>{t("about") || "About"}</Text>
              <Text style={styles.menuItemSub}>{t("aboutSub") || "App version & info"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={MUTED} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("language") || "Language"}</Text>
          <View style={styles.langGrid}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Pressable
                key={lang}
                style={[styles.langChip, language === lang ? styles.langChipActive : null]}
                onPress={() => setLanguage(lang)}
              >
                <Text style={[styles.langText, language === lang ? styles.langTextActive : null]}>{lang}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Pressable style={styles.logoutBtn} onPress={() => { signOut(); navigation.reset({ index: 0, routes: [{ name: "Splash" }] }); }}>
            <Ionicons name="log-out-outline" size={20} color="#ff6b6b" />
            <Text style={styles.logoutText}>{t("logout") || "Logout"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#262d35",
    marginBottom: 6
  },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  topTitle: { color: TEXT, fontSize: 18, fontWeight: "900", textTransform: "capitalize" },
  content: { padding: 16, paddingBottom: 60 },
  section: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#303842",
    padding: 4,
    marginBottom: 16
  },
  sectionTitle: { color: MUTED, fontSize: 12, fontWeight: "800", marginBottom: 12, paddingHorizontal: 12, paddingTop: 12 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 12
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#1a2028",
    alignItems: "center",
    justifyContent: "center"
  },
  menuItemContent: { flex: 1 },
  menuItemText: { color: TEXT, fontSize: 15, fontWeight: "700" },
  menuItemSub: { color: MUTED, fontSize: 11, fontWeight: "600", marginTop: 2 },
  badge: {
    backgroundColor: LIME,
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginRight: 6
  },
  badgeText: { color: "#1b1f23", fontSize: 11, fontWeight: "800" },
  langGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, paddingBottom: 14 },
  langChip: {
    borderWidth: 1,
    borderColor: "#3a3a3a",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#1a2028"
  },
  langChipActive: { backgroundColor: LIME, borderColor: LIME },
  langText: { color: "#9aa5ad", fontSize: 12, fontWeight: "800" },
  langTextActive: { color: "#1b1f23" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12
  },
  logoutText: { color: "#ff6b6b", fontSize: 15, fontWeight: "700" }
});
