import React from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { ImageSourcePropType } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BAR_BG = "#262626";
const ICON_COLOR = "#FFFFFF";
const LABEL_COLOR = "#FFFFFF";
const ICON_SIZE = 22;

const TAB_ICONS = {
  Overview: require("../../assets/provider/bottom-icons/overview.png"),
  Rental: require("../../assets/provider/bottom-icons/rental.png"),
  Listing: require("../../assets/provider/bottom-icons/listings.png"),
  Services: require("../../assets/provider/bottom-icons/services.png"),
  Profile: require("../../assets/provider/bottom-icons/profile.png")
} as const;

const TAB_META: Record<string, { label: string; icon: ImageSourcePropType; center?: boolean }> = {
  Overview: { label: "Overview", icon: TAB_ICONS.Overview },
  Rental: { label: "Rental", icon: TAB_ICONS.Rental },
  Listing: { label: "Listing", icon: TAB_ICONS.Listing, center: true },
  Services: { label: "Services", icon: TAB_ICONS.Services },
  Profile: { label: "Profile", icon: TAB_ICONS.Profile }
};

export function ProviderTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: bottomPad }]}
    >
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const meta = TAB_META[route.name] ?? {
            label: route.name,
            icon: TAB_ICONS.Overview
          };

          const onPress = () => {
            if (meta.center) {
              const parent = navigation.getParent();
              if (parent) {
                parent.navigate("ProviderNewListing");
              } else {
                navigation.navigate(route.name);
              }
              return;
            }
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.item}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel ?? meta.label}
            >
              <Image source={meta.icon} style={styles.icon} resizeMode="contain" />
              <Text style={styles.label}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingTop: 8,
    paddingHorizontal: 16,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderTopWidth: 0,
    borderTopColor: "transparent",
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    // Kill RN-web default hairlines on the tab container
    ...(Platform.OS === "web"
      ? ({
          outlineWidth: 0,
          outlineStyle: "none",
          borderTopStyle: "none"
        } as object)
      : null)
  },
  bar: {
    width: "100%",
    maxWidth: 399,
    height: 73,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14.72,
    gap: 11.04,
    borderRadius: 92.01,
    backgroundColor: BAR_BG,
    borderWidth: 0,
    overflow: "hidden"
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 0
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    tintColor: ICON_COLOR
  },
  label: {
    color: LABEL_COLOR,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center"
  }
});
