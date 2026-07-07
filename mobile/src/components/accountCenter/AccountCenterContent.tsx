import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/rootStackTypes";
import { APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../../theme/appColors";

type MenuItem = {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
};

type AccountCenterContentProps = {
  onClose: () => void;
  onNavigate: (screen: keyof RootStackParamList) => void;
};

function AccountCenterRow({
  title,
  icon,
  onPress,
  showDivider
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  showDivider?: boolean;
}) {
  return (
    <>
      <Pressable
        style={styles.row}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={22} color={APP_LIME} />
        </View>
        <Text style={styles.rowTitle}>{title}</Text>
        <Ionicons name="chevron-forward" size={18} color={APP_TEXT_MUTED} />
      </Pressable>
      {showDivider ? <View style={styles.rowDivider} /> : null}
    </>
  );
}

function MenuCard({ items }: { items: MenuItem[] }) {
  return (
    <View style={styles.card}>
      {items.map((item, index) => (
        <AccountCenterRow
          key={item.key}
          title={item.title}
          icon={item.icon}
          onPress={item.onPress}
          showDivider={index < items.length - 1}
        />
      ))}
    </View>
  );
}

export function AccountCenterContent({ onClose, onNavigate }: AccountCenterContentProps) {
  const noop = () => {};

  const go = (screen: keyof RootStackParamList) => {
    onNavigate(screen);
  };

  const primaryItems: MenuItem[] = [
    {
      key: "profiles",
      title: "Profiles & personal details",
      icon: "person-circle-outline",
      onPress: () => go("ProfilesPersonalDetails")
    }
  ];

  const settingsItems: MenuItem[] = [
    { key: "password", title: "Password And Security", icon: "key-outline", onPress: () => go("PasswordSecurity") },
    { key: "connected", title: "Connected Experiences", icon: "git-network-outline", onPress: () => go("ConnectedExperiences") },
    {
      key: "permissions",
      title: "Your Information And Permissions",
      icon: "shield-checkmark-outline",
      onPress: () => go("YourInformationPermissions")
    },
    { key: "ads", title: "Ad Preferences", icon: "megaphone-outline", onPress: noop },
    { key: "pay", title: "CropvibePay", icon: "wallet-outline", onPress: noop },
    { key: "subscriptions", title: "Subscriptions", icon: "cash-outline", onPress: noop },
    { key: "gallery", title: "Your Media Gallery", icon: "images-outline", onPress: noop }
  ];

  const manageItems: MenuItem[] = [
    { key: "manage", title: "Manage Accounts", icon: "people-outline", onPress: () => go("ManageAccounts") }
  ];

  return (
    <>
      <View style={styles.header}>
        <View style={styles.logoSlot}>
          <Text style={styles.logoText}>CROPVIBE</Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={28} color={APP_TEXT} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={styles.title}>Accounts Centre</Text>
        <Text style={styles.subtitle}>
          Manage your connected experience & account settings across cropvibe.{" "}
          <Text style={styles.learnMore} onPress={() => go("AboutAccountsCentre")}>
            Learn More
          </Text>
        </Text>

        <MenuCard items={primaryItems} />
        <View style={styles.cardSpacer} />
        <MenuCard items={settingsItems} />
        <View style={styles.cardSpacer} />
        <MenuCard items={manageItems} />
      </ScrollView>
    </>
  );
}

export type AccountCenterNavigation = NativeStackNavigationProp<RootStackParamList>;

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8
  },
  logoSlot: {
    minHeight: 36,
    justifyContent: "center"
  },
  logoText: {
    color: APP_LIME,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 1.5
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  scroll: {
    flexGrow: 0
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  title: {
    color: APP_TEXT,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 10
  },
  subtitle: {
    color: APP_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22
  },
  learnMore: {
    color: APP_LIME,
    fontWeight: "600"
  },
  card: {
    backgroundColor: APP_SURFACE,
    borderRadius: 14,
    overflow: "hidden"
  },
  cardSpacer: {
    height: 14
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 14
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  rowTitle: {
    flex: 1,
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "600"
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3a3a3a",
    marginLeft: 14 + 28 + 14
  }
});
