import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_BLACK, APP_LIME } from "../theme/appColors";

type Props = BottomTabBarProps & { onCreatePress: () => void };

const TAB_BG = APP_BLACK;
const MUTED = "#b9bec3";
const BRAND_ACCENT = APP_LIME;

function tabIcon(routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap {
  switch (routeName) {
    case "Home":
      return focused ? "home" : "home-outline";
    case "Market":
      return focused ? "storefront" : "storefront-outline";
    case "Learn":
      return focused ? "book" : "book-outline";
    case "Services":
      return focused ? "grid" : "grid-outline";
    case "Profile":
      return focused ? "person" : "person-outline";
    default:
      return "ellipse-outline";
  }
}

type TabSlotProps = {
  focused: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  label?: string;
  children: React.ReactNode;
};

function TabSlot({ focused, onPress, accessibilityLabel, label, children }: TabSlotProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabItem, focused ? styles.tabItemFocused : null]}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
      {label ? (
        <Text style={[styles.tabLabel, focused ? styles.tabLabelActive : null]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function MainTabBar({ state, navigation, onCreatePress }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 0 : Math.max(insets.bottom, 10);

  const isRouteFocused = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return false;
    return state.index === state.routes.indexOf(route);
  };

  const pressRoute = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return;
    const isFocused = state.index === state.routes.indexOf(route);
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (event.defaultPrevented) return;
    if (route.name === "Learn") {
      navigation.navigate({
        name: "Learn",
        params: { screen: "LearnHome" },
        merge: false
      } as never);
      return;
    }
    if (route.name === "Market") {
      navigation.navigate({
        name: "Market",
        params: { screen: "MarketplaceHome" },
        merge: false
      } as never);
      return;
    }
    if (!isFocused) navigation.navigate(route.name);
  };

  const homeFocused = isRouteFocused("Home");
  const marketFocused = isRouteFocused("Market");
  const servicesFocused = isRouteFocused("Services");
  const profileFocused = isRouteFocused("Profile");

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={styles.row}>
        <TabSlot focused={homeFocused} onPress={() => pressRoute("Home")} accessibilityLabel="Home">
          <View style={styles.logoWrap}>
            <Image
              source={require("../../assets/crop vibe.png")}
              style={[styles.logoImage, homeFocused ? styles.logoImageActive : styles.logoImageMuted]}
              resizeMode="contain"
            />
          </View>
        </TabSlot>

        <TabSlot
          focused={marketFocused}
          onPress={() => pressRoute("Market")}
          accessibilityLabel="Market"
          label="Market"
        >
          <Ionicons
            name={tabIcon("Market", marketFocused)}
            size={15}
            color={marketFocused ? BRAND_ACCENT : MUTED}
          />
        </TabSlot>

        <TabSlot focused={false} onPress={onCreatePress} accessibilityLabel="Create" label="Create">
          <Ionicons name="add-circle-outline" size={15} color={MUTED} />
        </TabSlot>

        <TabSlot
          focused={servicesFocused}
          onPress={() => pressRoute("Services")}
          accessibilityLabel="Community"
          label="Community"
        >
          <Ionicons
            name={tabIcon("Services", servicesFocused)}
            size={15}
            color={servicesFocused ? BRAND_ACCENT : MUTED}
          />
        </TabSlot>

        <TabSlot
          focused={profileFocused}
          onPress={() => pressRoute("Profile")}
          accessibilityLabel="Profile"
          label="Profile"
        >
          <Ionicons
            name={tabIcon("Profile", profileFocused)}
            size={15}
            color={profileFocused ? BRAND_ACCENT : MUTED}
          />
        </TabSlot>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: TAB_BG,
    borderTopWidth: 0,
    paddingTop: 5
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    paddingHorizontal: 6
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 2
  },
  tabItemFocused: {
    borderTopWidth: 2,
    borderTopColor: BRAND_ACCENT,
    marginTop: -2,
    paddingTop: 1
  },
  logoWrap: {
    width: "100%",
    minHeight: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  logoImage: { height: 12, width: "100%", maxWidth: 52, alignSelf: "center" },
  logoImageActive: { tintColor: BRAND_ACCENT, opacity: 1 },
  logoImageMuted: { tintColor: MUTED, opacity: 0.9 },
  tabLabel: {
    marginTop: 2,
    fontSize: Platform.OS === "web" ? 8 : 9,
    lineHeight: 11,
    fontWeight: "500",
    color: MUTED
  },
  tabLabelActive: { color: BRAND_ACCENT, fontWeight: "600" }
});
