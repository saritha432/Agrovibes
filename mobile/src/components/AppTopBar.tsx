import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { UserAvatar } from "./UserAvatar";
import { useNotificationPanel } from "../context/NotificationPanelContext";
import { navigateToDirectInbox, navigateToMyProfile, navigateToUserSearch } from "../navigation/navigationRef";
import { APP_BLACK, APP_DARK_BG, APP_LIME } from "../theme/appColors";

function CountBadge({ count }: { count: number }) {
  const label = String(Math.min(99, count));
  const wide = label.length > 1;
  return (
    <View style={[styles.badge, wide ? styles.badgeWide : styles.badgeRound]}>
      <Text style={styles.badgeText} allowFontScaling={false}>
        {label}
      </Text>
    </View>
  );
}

type AppTopBarProps = {
  showSearch?: boolean;
  showMessages?: boolean;
};

export function AppTopBar({ showSearch = true, showMessages = true }: AppTopBarProps) {
  const { user } = useAuth();
  const { openNotificationSheet, notificationUnreadCount, messageUnreadCount } = useNotificationPanel();

  return (
    <View style={styles.topBar}>
      <Image source={require("../../assets/crop vibe.png")} style={styles.logoImage} resizeMode="contain" />
      <View style={styles.rightSide}>
        {showSearch ? (
          <Pressable style={styles.iconBadge} onPress={navigateToUserSearch}>
            <Ionicons name="search-outline" size={16} color={APP_LIME} />
          </Pressable>
        ) : null}
        {showMessages ? (
          <Pressable style={styles.iconBadge} onPress={navigateToDirectInbox}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={APP_LIME} />
            {messageUnreadCount > 0 ? <CountBadge count={messageUnreadCount} /> : null}
          </Pressable>
        ) : null}
        <Pressable style={styles.iconBadge} onPress={openNotificationSheet}>
          <Ionicons name="notifications-outline" size={16} color={APP_LIME} />
          {notificationUnreadCount > 0 ? <CountBadge count={notificationUnreadCount} /> : null}
        </Pressable>
        <Pressable style={styles.iconBadge} onPress={navigateToMyProfile}>
          <UserAvatar
            uri={user?.avatarUrl || null}
            name={user?.fullName || user?.username || "U"}
            size={24}
            borderRadius={12}
            fallbackBackgroundColor="#1f2328"
            initialsColor={APP_LIME}
            textStyle={styles.profileInitial}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: APP_DARK_BG,
    paddingHorizontal: 10,
    paddingVertical: 7,
    paddingTop: 10
  },
  logoImage: { width: 132, height: 28, maxWidth: "46%" },
  rightSide: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: "auto" },
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  badge: {
    position: "absolute",
    right: -6,
    top: -5,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeRound: {
    width: 18,
    height: 18,
    borderRadius: 9
  },
  badgeWide: {
    minWidth: 22,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5
  },
  badgeText: {
    color: APP_BLACK,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: Platform.OS === "ios" ? 11 : 12,
    ...(Platform.OS === "android"
      ? { includeFontPadding: false, textAlignVertical: "center" as const }
      : { marginTop: -0.5 })
  },
  profileInitial: { fontWeight: "900" }
});
