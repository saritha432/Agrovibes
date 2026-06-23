import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Linking, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../localization/LanguageContext";
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

const BG = APP_BLACK;
const LIME = APP_LIME;
const CARD = APP_SURFACE;
const TEXT = APP_TEXT;
const MUTED = APP_TEXT_MUTED;
const DIVIDER = "#3a3a3a";
const ICON_SLOT = 28;

type SettingsRowProps = {
  title: string;
  subtitle?: string;
  trailing?: string;
  onPress?: () => void;
  showDivider?: boolean;
  showChevron?: boolean;
};

function SettingsRow({
  title,
  subtitle,
  trailing,
  onPress,
  showDivider = true,
  showChevron = true
}: SettingsRowProps) {
  return (
    <>
      <Pressable
        style={[styles.row, subtitle ? styles.rowTall : null]}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <View style={styles.iconSlot} />
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
        {trailing ? <Text style={styles.rowTrailing}>{trailing}</Text> : null}
        {showChevron ? <Ionicons name="chevron-forward" size={18} color={MUTED} /> : null}
      </Pressable>
      {showDivider ? <View style={styles.rowDivider} /> : null}
    </>
  );
}

type SettingsSectionProps = {
  title: string;
  children: React.ReactNode;
};

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionHeading}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SettingsRowList({
  items
}: {
  items: Array<Omit<SettingsRowProps, "showDivider"> & { key: string }>;
}) {
  return (
    <>
      {items.map((item, index) => {
        const { key, ...rowProps } = item;
        return <SettingsRow key={key} {...rowProps} showDivider={index < items.length - 1} />;
      })}
    </>
  );
}

function PromoCard() {
  return (
    <View style={styles.promoWrap}>
      <View style={styles.promoCard}>
        <LinearGradient
          colors={["rgba(201, 255, 53, 0.55)", "rgba(201, 255, 53, 0)"]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.4, y: 1 }}
          style={styles.promoGlow}
          pointerEvents="none"
        />
        <Text style={styles.promoTitle}>Khet Se Ghar Tak</Text>
        <Text style={styles.promoSubtitle}>Bhoomi, Bazaar, Barakath.</Text>
      </View>
    </View>
  );
}

export function SettingsMenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { signOut } = useAuth();
  const { t } = useLanguage();
  const topInset = Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0;

  const openSaved = () => {
    navigation.goBack();
    setTimeout(
      () => navigation.navigate("Main", { screen: "Profile", params: { initialTab: "Saved" } } as any),
      120
    );
  };

  const noop = () => {};

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={[styles.topBar, topInset > 0 ? { paddingTop: 4 } : null]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={28} color={LIME} />
        </Pressable>
        <Text style={styles.topTitle}>Settings & Privacy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsSection title="Your Account">
          <SettingsRow
            title="Account Center"
            subtitle="Manage accounts, personal details, connected experiences, & preferences"
            onPress={() => navigation.navigate("EditProfile")}
            showDivider={false}
          />
        </SettingsSection>

        <PromoCard />

        <SettingsSection title="How you use cropvibe">
          <SettingsRowList
            items={[
              { key: "saved", title: "Saved", onPress: openSaved },
              { key: "archive", title: "Archive", onPress: noop },
              { key: "activity", title: "Your Activity", onPress: noop },
              { key: "notifications", title: "Notifications", onPress: noop },
              { key: "time", title: "Time Management", onPress: noop },
              { key: "ipad", title: "Cropvibe For iPad", onPress: noop }
            ]}
          />
        </SettingsSection>

        <SettingsSection title="Who can see your content">
          <SettingsRowList
            items={[
              { key: "privacy", title: "Account Privacy", onPress: () => navigation.navigate("Privacy") },
              { key: "close-friends", title: "Close Friends", onPress: noop },
              { key: "cross-posting", title: "Cross Posting", onPress: noop },
              { key: "blocked", title: "Blocked", onPress: noop },
              { key: "story-live", title: "Story, Live And Location", onPress: noop },
              { key: "friends-feed", title: "Activity In Friends Feed", onPress: noop }
            ]}
          />
        </SettingsSection>

        <SettingsSection title="How others can interact with you">
          <SettingsRowList
            items={[
              { key: "messages", title: "Messages And Story Replies", onPress: noop },
              { key: "tags", title: "Tags And Mentions", onPress: noop },
              { key: "comments", title: "Comments", onPress: noop },
              { key: "sharing", title: "Sharing", onPress: noop },
              { key: "restricted", title: "Restricted", onPress: noop },
              { key: "limit", title: "Limit Interactions", onPress: noop },
              { key: "hidden-words", title: "Hidden Words", onPress: noop },
              { key: "invite", title: "Follow and invite friends", onPress: noop }
            ]}
          />
        </SettingsSection>

        <SettingsSection title="What You See">
          <SettingsRowList
            items={[
              { key: "favorites", title: "Favorites", onPress: noop },
              { key: "muted", title: "Muted Accounts", onPress: noop },
              { key: "content-prefs", title: "Content preferences", onPress: noop },
              { key: "like-counts", title: "Like and share counts", onPress: noop },
              { key: "creator-subs", title: "Creator Subscriptions", onPress: noop }
            ]}
          />
        </SettingsSection>

        <SettingsSection title="App, Media & Accessibility Settings">
          <SettingsRowList
            items={[
              { key: "device-perms", title: "Device Permissions", onPress: noop },
              { key: "archiving", title: "Archiving And Downloading", onPress: noop },
              { key: "accessibility", title: "Accessibility", onPress: noop },
              { key: "language", title: "Language And Translations", onPress: noop },
              { key: "media-quality", title: "Media Quality", onPress: noop },
              { key: "website-perms", title: "Website Permissions", onPress: noop }
            ]}
          />
        </SettingsSection>

        <SettingsSection title="Family Centre">
          <SettingsRow title="Supervision For Teen Accounts" onPress={noop} showDivider={false} />
        </SettingsSection>

        <SettingsSection title="Your Insights And Tools">
          <SettingsRow title="Account Type And Tools" onPress={noop} showDivider={false} />
        </SettingsSection>

        <SettingsSection title="Subscriptions">
          <SettingsRowList
            items={[
              { key: "plus", title: "Cropvibe Plus", trailing: "Not Subscribed", onPress: noop },
              { key: "verified", title: "Cropvibe Verified", trailing: "Not Subscribed", onPress: noop },
              { key: "all-subs", title: "All Subscriptions", onPress: noop }
            ]}
          />
        </SettingsSection>

        <SettingsSection title="More Info And Support">
          <SettingsRowList
            items={[
              {
                key: "help",
                title: "Help",
                onPress: () => void Linking.openURL("mailto:support@cropvibe.com")
              },
              { key: "ai-support", title: "Cropvibe AI Support Assistant", onPress: noop },
              { key: "privacy-centre", title: "Privacy Centre", onPress: () => navigation.navigate("Privacy") },
              { key: "account-status", title: "Account Status", onPress: noop },
              { key: "about", title: "About", onPress: () => navigation.navigate("About") }
            ]}
          />
        </SettingsSection>

        <SettingsSection title="Login">
          <SettingsRow title="Add Account" onPress={noop} showDivider={false} />
        </SettingsSection>

        <View style={styles.footerSection}>
          <Pressable
            style={styles.logoutBtn}
            onPress={() => {
              signOut();
              navigation.reset({ index: 0, routes: [{ name: "Splash" }] });
            }}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <View style={styles.logoutIconSlot} />
            <Text style={styles.logoutText}>{t("logout") || "Log Out"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 12,
    gap: 4
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  topTitle: {
    flex: 1,
    color: TEXT,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32
  },
  sectionWrap: {
    marginBottom: 22
  },
  sectionHeading: {
    color: MUTED,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
    paddingHorizontal: 2
  },
  sectionCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    overflow: "hidden"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 14
  },
  rowTall: {
    alignItems: "flex-start",
    paddingVertical: 16,
    minHeight: 72
  },
  iconSlot: {
    width: ICON_SLOT,
    height: ICON_SLOT
  },
  rowBody: {
    flex: 1,
    paddingRight: 8
  },
  rowTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20
  },
  rowSubtitle: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    fontWeight: "500"
  },
  rowTrailing: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "500",
    marginRight: 2
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DIVIDER,
    marginLeft: 14 + ICON_SLOT + 14
  },
  promoWrap: {
    marginBottom: 22
  },
  promoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 22,
    overflow: "hidden",
    minHeight: 108,
    justifyContent: "center"
  },
  promoGlow: {
    position: "absolute",
    top: -20,
    right: -10,
    width: 180,
    height: 120,
    borderRadius: 90
  },
  promoTitle: {
    color: "#111111",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4
  },
  promoSubtitle: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
    opacity: 0.92
  },
  footerSection: {
    marginTop: 8,
    marginBottom: 8,
    alignItems: "center"
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20
  },
  logoutIconSlot: {
    width: ICON_SLOT,
    height: ICON_SLOT
  },
  logoutText: {
    color: "#ff6b6b",
    fontSize: 15,
    fontWeight: "700"
  }
});
