import React from "react";
import { Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useNotificationPanel } from "../context/NotificationPanelContext";
import { APP_BLACK, APP_DARK_BG, APP_LIME } from "../theme/appColors";
import { useTopChromeInset } from "../theme/topChromeInset";

export { useModalTopChromeInset, useTopChromeInset } from "../theme/topChromeInset";

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

export function AppTopBar() {
  const { openNotificationSheet, notificationUnreadCount } = useNotificationPanel();
  const topInset = useTopChromeInset();
  const { height: windowHeight } = useWindowDimensions();
  const compact = windowHeight > 0 && windowHeight < 700;

  return (
    <View style={[styles.topBar, { paddingTop: topInset }]}>
      <View style={[styles.topBarContent, compact ? styles.topBarContentCompact : null]}>
        <Image source={require("../../assets/crop vibe.png")} style={styles.logoImage} resizeMode="contain" />
        <Pressable style={styles.iconBadge} onPress={openNotificationSheet} accessibilityLabel="Notifications">
          <Image source={require("../../assets/notifications.png")} style={styles.notificationIcon} resizeMode="contain" />
          {notificationUnreadCount > 0 ? <CountBadge count={notificationUnreadCount} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    backgroundColor: APP_DARK_BG
  },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 44,
    paddingHorizontal: 10,
    paddingBottom: 4
  },
  topBarContentCompact: {
    minHeight: 40,
    paddingBottom: 2
  },
  logoImage: { width: 132, height: 28, maxWidth: "46%" },
  iconBadge: {
    width: 24,
    height: 24,
    marginLeft: "auto",
    alignItems: "center",
    justifyContent: "center"
  },
  notificationIcon: {
    width: 34,
    height: 34
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
  }
});
