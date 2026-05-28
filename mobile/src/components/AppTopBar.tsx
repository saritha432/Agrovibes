import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { UserAvatar } from "./UserAvatar";
import { useNotificationPanel } from "../context/NotificationPanelContext";
import { navigateToDirectInbox, navigateToMyProfile, navigateToUserSearch } from "../navigation/navigationRef";
import { APP_BLACK, APP_DARK_BG, APP_LIME } from "../theme/appColors";

export function AppTopBar() {
  const { user } = useAuth();
  const { openNotificationSheet, notificationUnreadCount, messageUnreadCount } = useNotificationPanel();

  return (
    <View style={styles.topBar}>
      <Image source={require("../../assets/crop vibe.png")} style={styles.logoImage} resizeMode="contain" />
      <View style={styles.rightSide}>
        <Pressable style={styles.iconBadge} onPress={navigateToUserSearch}>
          <Ionicons name="search-outline" size={16} color={APP_LIME} />
        </Pressable>
        <Pressable style={styles.iconBadge} onPress={navigateToDirectInbox}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={APP_LIME} />
          {messageUnreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{Math.min(99, messageUnreadCount)}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable style={styles.iconBadge} onPress={openNotificationSheet}>
          <Ionicons name="notifications-outline" size={16} color={APP_LIME} />
          {notificationUnreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{Math.min(99, notificationUnreadCount)}</Text>
            </View>
          ) : null}
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
    right: -5,
    top: -4,
    backgroundColor: APP_LIME,
    borderRadius: 7,
    minWidth: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: { color: APP_BLACK, fontSize: 8, fontWeight: "700" },
  profileInitial: { fontWeight: "900" }
});
