import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useNotificationPanel } from "../context/NotificationPanelContext";
import { navigateToDirectInbox, navigateToUserSearch } from "../navigation/navigationRef";

export function AppTopBar() {
  const { openNotificationSheet, notificationUnreadCount, messageUnreadCount } = useNotificationPanel();

  return (
    <View style={styles.topBar}>
      <Image source={require("../../assets/crop vibe.png")} style={styles.logoImage} resizeMode="contain" />
      <View style={styles.rightSide}>
        <Pressable style={styles.iconBadge} onPress={navigateToUserSearch}>
          <Ionicons name="search-outline" size={16} color="#d8ff37" />
        </Pressable>
        <Pressable style={styles.iconBadge} onPress={navigateToDirectInbox}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color="#d8ff37" />
          {messageUnreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{Math.min(99, messageUnreadCount)}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable style={styles.iconBadge} onPress={openNotificationSheet}>
          <Ionicons name="notifications-outline" size={16} color="#d8ff37" />
          {notificationUnreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{Math.min(99, notificationUnreadCount)}</Text>
            </View>
          ) : null}
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
    backgroundColor: "#262626",
    paddingHorizontal: 10,
    paddingVertical: 7,
    paddingTop: 10
  },
  logoImage: { width: 100, height: 24 },
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
    backgroundColor: "#d8ff37",
    borderRadius: 7,
    minWidth: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: { color: "#1f2b28", fontSize: 8, fontWeight: "700" }
});
