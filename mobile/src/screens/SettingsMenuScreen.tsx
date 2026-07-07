import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../localization/LanguageContext";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";
import { AccountCenterBottomSheet } from "../components/accountCenter/AccountCenterBottomSheet";

const BG = APP_BLACK;
const CARD = "#303132";
const LIME = APP_LIME;
const TEXT = APP_TEXT;
const MUTED = APP_TEXT_MUTED;
const DIVIDER = "rgba(255,255,255,0.1)";
const SECTION_HEADING = "rgba(255, 255, 255, 0.55)";
const ICON_SIZE = 24;
const ICON_SLOT = 38;

type SettingsRowProps = {
  title: string;
  subtitle?: string;
  trailing?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  showDivider?: boolean;
  showChevron?: boolean;
};

function SettingsRow({
  title,
  subtitle,
  trailing,
  icon,
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
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={ICON_SIZE} color={LIME} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
        {trailing ? <Text style={styles.rowTrailing}>{trailing}</Text> : null}
        {showChevron ? (
          <View style={styles.chevronWrap}>
            <Ionicons name="chevron-forward" size={20} color={MUTED} />
          </View>
        ) : null}
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
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeading}>{title}</Text>
        </View>
        {children}
      </View>
    </View>
  );
}

type SettingsRowItem = Omit<SettingsRowProps, "showDivider"> & { key: string };

function SettingsRowList({ items }: { items: SettingsRowItem[] }) {
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
  const [accountCenterOpen, setAccountCenterOpen] = useState(false);

  const openSaved = () => navigation.navigate("SavedSettings");

  const noop = () => {};

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={LIME} />
        </Pressable>
        <Text style={styles.topTitle}>Settings & Privacy</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsSection title="Your Account">
          <SettingsRow
            icon="person-circle-outline"
            title="Account Center"
            subtitle="Manage accounts, personal details, connected experiences, & preferences"
            onPress={() => setAccountCenterOpen(true)}
            showDivider={false}
          />
        </SettingsSection>

        <PromoCard />

        <SettingsSection title="How you use cropvibe">
          <SettingsRowList
            items={[
              { key: "saved", title: "Saved", icon: "bookmark-outline", onPress: openSaved },
              { key: "archive", title: "Archive", icon: "archive-outline", onPress: noop },
              { key: "activity", title: "Your Activity", icon: "pulse-outline", onPress: noop },
              {
                key: "notifications",
                title: "Notifications",
                icon: "notifications-outline",
                onPress: () => navigation.navigate("NotificationsSettings")
              },
              { key: "time", title: "Time Management", icon: "time-outline", onPress: noop },
              { key: "ipad", title: "Cropvibe For iPad", icon: "tablet-portrait-outline", onPress: noop }
            ]}
          />
        </SettingsSection>

        <SettingsSection title="Who can see your content">
          <SettingsRowList
            items={[
              { key: "privacy", title: "Account Privacy", icon: "lock-closed-outline", onPress: () => navigation.navigate("Privacy") },
              { key: "close-friends", title: "Close Friends", icon: "heart-outline", onPress: noop },
              { key: "cross-posting", title: "Cross Posting", icon: "git-compare-outline", onPress: noop },
              { key: "blocked", title: "Blocked", icon: "ban-outline", onPress: noop },
              { key: "story-live", title: "Story, Live And Location", icon: "location-outline", onPress: noop },
              { key: "friends-feed", title: "Activity In Friends Feed", icon: "people-outline", onPress: noop }
            ]}
          />
        </SettingsSection>

        <SettingsSection title="How others can interact with you">
          <SettingsRowList
            items={[
              { key: "messages", title: "Messages And Story Replies", icon: "chatbubble-ellipses-outline", onPress: noop },
              { key: "tags", title: "Tags And Mentions", icon: "at-outline", onPress: noop },
              { key: "comments", title: "Comments", icon: "chatbox-outline", onPress: noop },
              { key: "sharing", title: "Sharing", icon: "share-social-outline", onPress: noop },
              { key: "restricted", title: "Restricted", icon: "eye-off-outline", onPress: noop },
              { key: "limit", title: "Limit Interactions", icon: "hand-left-outline", onPress: noop },
              { key: "hidden-words", title: "Hidden Words", icon: "text-outline", onPress: noop },
              { key: "invite", title: "Follow and invite friends", icon: "person-add-outline", onPress: noop }
            ]}
          />
        </SettingsSection>

        <SettingsSection title="What You See">
          <SettingsRowList
            items={[
              { key: "favorites", title: "Favorites", icon: "star-outline", onPress: noop },
              { key: "muted", title: "Muted Accounts", icon: "volume-mute-outline", onPress: noop },
              { key: "content-prefs", title: "Content preferences", icon: "options-outline", onPress: noop },
              { key: "like-counts", title: "Like and share counts", icon: "heart-outline", onPress: noop }
              // Figma: blurred / not yet available
              // { key: "creator-subs", title: "Creator Subscriptions", icon: "ribbon-outline", onPress: noop }
            ]}
          />
        </SettingsSection>

        <SettingsSection title="App, Media & Accessibility Settings">
          <SettingsRowList
            items={[
              { key: "device-perms", title: "Device Permissions", icon: "phone-portrait-outline", onPress: noop },
              { key: "archiving", title: "Archiving And Downloading", icon: "download-outline", onPress: noop },
              { key: "accessibility", title: "Accessibility", icon: "accessibility-outline", onPress: noop },
              { key: "language", title: "Language And Translations", icon: "language-outline", onPress: noop },
              { key: "media-quality", title: "Media Quality", icon: "images-outline", onPress: noop },
              { key: "website-perms", title: "Website Permissions", icon: "globe-outline", onPress: noop }
            ]}
          />
        </SettingsSection>

        {/* Figma: blurred / not yet available */}
        {/* <SettingsSection title="Family Centre">
          <SettingsRow
            icon="shield-outline"
            title="Supervision For Teen Accounts"
            onPress={noop}
            showDivider={false}
          />
        </SettingsSection> */}

        {/* Figma: blurred / not yet available */}
        {/* <SettingsSection title="Your Insights And Tools">
          <SettingsRow icon="bar-chart-outline" title="Account Type And Tools" onPress={noop} showDivider={false} />
        </SettingsSection> */}

        {/* Figma: blurred / not yet available */}
        {/* <SettingsSection title="Subscriptions">
          <SettingsRowList
            items={[
              { key: "plus", title: "Cropvibe Plus", trailing: "Not Subscribed", icon: "sparkles-outline", onPress: noop },
              { key: "verified", title: "Cropvibe Verified", trailing: "Not Subscribed", icon: "checkmark-circle-outline", onPress: noop },
              { key: "all-subs", title: "All Subscriptions", icon: "card-outline", onPress: noop }
            ]}
          />
        </SettingsSection> */}

        <SettingsSection title="More Info And Support">
          <SettingsRowList
            items={[
              // { key: "help", title: "Help", icon: "help-circle-outline", onPress: () => void Linking.openURL("mailto:support@cropvibe.com") },
              // { key: "ai-support", title: "Cropvibe AI Support Assistant", icon: "sparkles-outline", onPress: noop },
              { key: "privacy-centre", title: "Privacy Centre", icon: "shield-checkmark-outline", onPress: () => navigation.navigate("Privacy") },
              // { key: "account-status", title: "Account Status", icon: "information-circle-outline", onPress: noop },
              { key: "about", title: "About", icon: "information-outline", onPress: () => navigation.navigate("About") }
            ]}
          />
        </SettingsSection>

        <SettingsSection title="Login">
          <SettingsRow icon="person-add-outline" title="Add Account" onPress={noop} showDivider={false} />
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
            <Ionicons name="log-out-outline" size={22} color="#ff6b6b" />
            <Text style={styles.logoutText}>{t("logout") || "Log Out"}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <AccountCenterBottomSheet visible={accountCenterOpen} onClose={() => setAccountCenterOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER
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
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.1
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32
  },
  sectionWrap: {
    marginBottom: 16
  },
  sectionCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: DIVIDER
  },
  sectionHeader: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 46,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER
  },
  sectionHeading: {
    color: SECTION_HEADING,
    fontSize: 16,
    fontWeight: "500",
    textTransform: "capitalize"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 63,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12
  },
  rowTall: {
    alignItems: "flex-start",
    paddingVertical: 14,
    minHeight: 78
  },
  iconWrap: {
    width: ICON_SLOT,
    height: ICON_SLOT,
    alignItems: "center",
    justifyContent: "center"
  },
  rowBody: {
    flex: 1,
    paddingRight: 8,
    minWidth: 0
  },
  rowTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19
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
    fontSize: 12,
    fontWeight: "500",
    marginRight: 4
  },
  chevronWrap: {
    width: ICON_SLOT,
    height: ICON_SLOT,
    alignItems: "center",
    justifyContent: "center"
  },
  rowDivider: {
    height: 1,
    backgroundColor: DIVIDER
  },
  promoWrap: {
    marginBottom: 16
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
  logoutText: {
    color: "#ff6b6b",
    fontSize: 15,
    fontWeight: "700"
  }
});
