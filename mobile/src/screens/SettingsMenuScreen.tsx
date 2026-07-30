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

function PromoCard({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      style={styles.promoWrap}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel="Join As Provider"
    >
      <View style={styles.promoCard}>
        <LinearGradient
          colors={["rgba(201, 255, 53, 0.45)", "rgba(201, 255, 53, 0)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 0.55, y: 0.5 }}
          style={styles.promoGlowLeft}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["rgba(201, 255, 53, 0)", "rgba(201, 255, 53, 0.35)"]}
          start={{ x: 0.45, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.promoGlowRight}
          pointerEvents="none"
        />
        <Text style={styles.promoTitle}>
          Rent It. Service It. <Text style={styles.promoTitleAccent}>Earn</Text>
        </Text>
        <Text style={styles.promoSubtitle}>Machinery. Experts. Opportunity.</Text>
        <View style={styles.promoCta}>
          <Text style={styles.promoCtaText}>Join As Provider</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function SettingsMenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { signOut } = useAuth();
  const { t, language } = useLanguage();
  const [accountCenterOpen, setAccountCenterOpen] = useState(false);

  const openSaved = () => navigation.navigate("SavedSettings");

  const noop = () => {};

  const labels: Record<string, string> = {
    settingsPrivacyTitle:
      language === "Hindi"
        ? "सेटिंग्स और प्राइवेसी"
        : language === "Telugu"
          ? "సెట్టింగ్స్ & ప్రైవసీ"
          : language === "Kannada"
            ? "ಸೆಟ್ಟಿಂಗ್ಸ್ & ಪ್ರೈವಸಿ"
            : language === "Malayalam"
              ? "സെറ്റിംഗ്സ് & പ്രൈവസി"
              : language === "Tamil"
                ? "அமைப்புகள் & தனியுரிமை"
                : language === "Marathi"
                  ? "सेटिंग्स आणि प्रायव्हसी"
                  : language === "Bengali"
                    ? "সেটিংস & প্রাইভেসি"
                    : "Settings & Privacy",
    yourAccount:
      language === "Hindi"
        ? "आपका अकाउंट"
        : language === "Telugu"
          ? "మీ అకౌంట్"
          : language === "Kannada"
            ? "ನಿಮ್ಮ ಅಕೌಂಟ್"
            : language === "Malayalam"
              ? "നിങ്ങളുടെ അക്കൗണ്ട്"
              : language === "Tamil"
                ? "உங்கள் கணக்கு"
                : language === "Marathi"
                  ? "तुमचे खाते"
                  : language === "Bengali"
                    ? "আপনার অ্যাকাউন্ট"
                    : "Your Account",
    howYouUse:
      language === "Hindi"
        ? "आप क्रॉपवाइब कैसे इस्तेमाल करते हैं"
        : language === "Telugu"
          ? "మీరు క్రాప్‌వైబ్‌ను ఎలా ఉపయోగిస్తున్నారు"
          : language === "Kannada"
            ? "ನೀವು ಕ್ರಾಪ್‌ವೈಬ್ ಅನ್ನು ಹೇಗೆ ಬಳಸುತ್ತೀರಿ"
            : language === "Malayalam"
              ? "നിങ്ങൾ ക്രോപ്വൈബ് എങ്ങനെ ഉപയോഗിക്കുന്നു"
              : language === "Tamil"
                ? "நீங்கள் Cropvibe-ஐ எப்படி பயன்படுத்துகிறீர்கள்"
                : language === "Marathi"
                  ? "तुम्ही Cropvibe कसा वापरता"
                  : language === "Bengali"
                    ? "আপনি Cropvibe কীভাবে ব্যবহার করেন"
                    : "How You Use Cropvibe",
    whoCanSee:
      language === "Hindi"
        ? "आपका कंटेंट कौन देख सकता है"
        : language === "Telugu"
          ? "మీ కంటెంట్‌ను ఎవరు చూడగలరు"
          : language === "Kannada"
            ? "ನಿಮ್ಮ ವಿಷಯವನ್ನು ಯಾರು ನೋಡಬಹುದು"
            : language === "Malayalam"
              ? "നിങ്ങളുടെ ഉള്ളടക്കം ആര്‍ക്ക് കാണാം"
              : language === "Tamil"
                ? "உங்கள் உள்ளடக்கத்தை யார் பார்க்கலாம்"
                : language === "Marathi"
                  ? "तुमचा कंटेंट कोण पाहू शकतो"
                  : language === "Bengali"
                    ? "আপনার কনটেন্ট কে দেখতে পারে"
                    : "Who Can See Your Content",
    appMedia:
      language === "Hindi"
        ? "ऐप, मीडिया और एक्सेसिबिलिटी सेटिंग्स"
        : language === "Telugu"
          ? "యాప్, మీడియా & యాక్సెసిబిలిటీ సెట్టింగ్స్"
          : language === "Kannada"
            ? "ಆಪ್, ಮೀಡಿಯಾ & ಪ್ರವೇಶಾರ್ಹತೆ ಸೆಟ್ಟಿಂಗ್ಸ್"
            : language === "Malayalam"
              ? "ആപ്പ്, മീഡിയ & ആക്സസിബിലിറ്റി സെറ്റിംഗുകൾ"
              : language === "Tamil"
                ? "ஆப், மீடியா & அணுகல் அமைப்புகள்"
                : language === "Marathi"
                  ? "अॅप, मीडिया आणि अॅक्सेसिबिलिटी सेटिंग्ज"
                  : language === "Bengali"
                    ? "অ্যাপ, মিডিয়া ও অ্যাক্সেসিবিলিটি সেটিংস"
                    : "App, Media & Accessibility Settings",
    moreInfo:
      language === "Hindi"
        ? "अधिक जानकारी और सहायता"
        : language === "Telugu"
          ? "మరిన్ని సమాచారం & సహాయం"
          : language === "Kannada"
            ? "ಹೆಚ್ಚಿನ ಮಾಹಿತಿ ಮತ್ತು ಸಹಾಯ"
            : language === "Malayalam"
              ? "കൂടുതൽ വിവരം & പിന്തുണ"
              : language === "Tamil"
                ? "மேலும் தகவல் & ஆதரவு"
                : language === "Marathi"
                  ? "अधिक माहिती आणि सहाय्य"
                  : language === "Bengali"
                    ? "আরও তথ্য ও সহায়তা"
                    : "More Info And Support",
    accountCenter: language === "English" ? "Account Center" : t("accountCenter"),
    accountCenterSub:
      language === "Hindi"
        ? "अकाउंट, पर्सनल डिटेल्स और प्रेफरेंसेज़ मैनेज करें"
        : language === "Telugu"
          ? "అకౌంట్లు, వ్యక్తిగత వివరాలు మరియు ప్రాధాన్యతలను నిర్వహించండి"
          : language === "Kannada"
            ? "ಖಾತೆ, ವೈಯಕ್ತಿಕ ವಿವರಗಳು ಮತ್ತು ಆದ್ಯತೆಗಳನ್ನು ನಿರ್ವಹಿಸಿ"
            : language === "Malayalam"
              ? "അക്കൗണ്ടുകൾ, വ്യക്തിഗത വിവരങ്ങൾ, മുൻഗണനകൾ നിയന്ത്രിക്കുക"
              : language === "Tamil"
                ? "கணக்குகள், தனிப்பட்ட விவரங்கள் மற்றும் விருப்பங்களை நிர்வகிக்கவும்"
                : language === "Marathi"
                  ? "अकाउंट्स, वैयक्तिक माहिती आणि प्राधान्ये व्यवस्थापित करा"
                  : language === "Bengali"
                    ? "অ্যাকাউন্ট, ব্যক্তিগত তথ্য ও পছন্দ পরিচালনা করুন"
                    : "Manage accounts, personal details, connected experiences, & preferences",
    yourActivity:
      language === "Hindi" ? "आपकी गतिविधि" : language === "Telugu" ? "మీ కార్యాచరణ" : language === "Tamil" ? "உங்கள் செயல்பாடு" : "Your Activity",
    accountPrivacy:
      language === "Hindi" ? "अकाउंट प्राइवेसी" : language === "Telugu" ? "అకౌంట్ ప్రైవసీ" : language === "Tamil" ? "கணக்கு தனியுரிமை" : "Account Privacy",
    blocked: language === "Hindi" ? "ब्लॉक किए गए अकाउंट" : language === "Telugu" ? "బ్లాక్ చేసిన ఖాతాలు" : language === "Tamil" ? "தடை செய்யப்பட்ட கணக்குகள்" : "Blocked",
    languageTranslations:
      language === "Hindi"
        ? "भाषा और अनुवाद"
        : language === "Telugu"
          ? "భాష & అనువాదాలు"
          : language === "Tamil"
            ? "மொழி & மொழிபெயர்ப்புகள்"
            : "Language And Translations"
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={LIME} />
        </Pressable>
        <Text style={styles.topTitle}>{labels.settingsPrivacyTitle}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsSection title={labels.yourAccount}>
          <SettingsRow
            icon="person-circle-outline"
            title={labels.accountCenter}
            subtitle={labels.accountCenterSub}
            onPress={() => setAccountCenterOpen(true)}
            showDivider={false}
          />
        </SettingsSection>

        <PromoCard onPress={() => navigation.navigate("ProviderOnboarding")} />

        <SettingsSection title={labels.howYouUse}>
          <SettingsRowList
            items={[
              { key: "saved", title: "Saved", icon: "bookmark-outline", onPress: openSaved },
              // hidden as requested
              // { key: "archive", title: "Archive", icon: "archive-outline", onPress: noop },
              { key: "activity", title: labels.yourActivity, icon: "pulse-outline", onPress: () => navigation.navigate("YourActivity") },
              {
                key: "notifications",
                title: "Notifications",
                icon: "notifications-outline",
                onPress: () => navigation.navigate("NotificationsSettings")
              }
              // hidden as requested
              // { key: "time", title: "Time Management", icon: "time-outline", onPress: noop },
              // { key: "ipad", title: "Cropvibe For iPad", icon: "tablet-portrait-outline", onPress: noop }
            ]}
          />
        </SettingsSection>

        <SettingsSection title={labels.whoCanSee}>
          <SettingsRowList
            items={[
              { key: "privacy", title: labels.accountPrivacy, icon: "lock-closed-outline", onPress: () => navigation.navigate("Privacy") },
              { key: "blocked", title: labels.blocked, icon: "ban-outline", onPress: () => navigation.navigate("BlockedAccounts") },
              // hidden as requested
              // { key: "close-friends", title: "Close Friends", icon: "heart-outline", onPress: noop },
              // { key: "cross-posting", title: "Cross Posting", icon: "git-compare-outline", onPress: noop },
              // { key: "story-live", title: "Story, Live And Location", icon: "location-outline", onPress: noop },
              // { key: "friends-feed", title: "Activity In Friends Feed", icon: "people-outline", onPress: noop }
            ]}
          />
        </SettingsSection>

        {/* hidden as requested */}
        {/* <SettingsSection title="How others can interact with you">
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
        </SettingsSection> */}

        {/* hidden as requested */}
        {/* <SettingsSection title="What You See">
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
        </SettingsSection> */}

        <SettingsSection title={labels.appMedia}>
          <SettingsRowList
            items={[
              { key: "language", title: labels.languageTranslations, icon: "language-outline", onPress: () => navigation.navigate("LanguageTranslations") }
              // hidden as requested
              // { key: "device-perms", title: "Device Permissions", icon: "phone-portrait-outline", onPress: noop },
              // { key: "archiving", title: "Archiving And Downloading", icon: "download-outline", onPress: noop },
              // { key: "accessibility", title: "Accessibility", icon: "accessibility-outline", onPress: noop },
              // { key: "media-quality", title: "Media Quality", icon: "images-outline", onPress: noop },
              // { key: "website-perms", title: "Website Permissions", icon: "globe-outline", onPress: noop }
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

        <SettingsSection title={labels.moreInfo}>
          <SettingsRowList
            items={[
              // { key: "help", title: "Help", icon: "help-circle-outline", onPress: () => void Linking.openURL("mailto:support@cropvibe.com") },
              // { key: "ai-support", title: "Cropvibe AI Support Assistant", icon: "sparkles-outline", onPress: noop },
              // hidden as requested
              // { key: "privacy-centre", title: "Privacy Centre", icon: "shield-checkmark-outline", onPress: () => navigation.navigate("Privacy") },
              // { key: "account-status", title: "Account Status", icon: "information-circle-outline", onPress: noop },
              { key: "about", title: "About", icon: "information-outline", onPress: () => navigation.navigate("About") }
            ]}
          />
        </SettingsSection>

        {/* hidden as requested */}
        {/* <SettingsSection title="Login">
          <SettingsRow icon="person-add-outline" title="Add Account" onPress={noop} showDivider={false} />
        </SettingsSection> */}

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
    backgroundColor: "#1a1b1c",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    overflow: "hidden",
    minHeight: 132,
    borderWidth: 1,
    borderColor: "rgba(201, 255, 53, 0.12)"
  },
  promoGlowLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 120
  },
  promoGlowRight: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 100
  },
  promoTitle: {
    color: TEXT,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    lineHeight: 28
  },
  promoTitleAccent: {
    color: LIME,
    fontWeight: "800"
  },
  promoSubtitle: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 6,
    letterSpacing: 0.1
  },
  promoCta: {
    alignSelf: "flex-start",
    marginTop: 16,
    backgroundColor: "#0d0d0d",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(201, 255, 53, 0.28)"
  },
  promoCtaText: {
    color: LIME,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.1
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
