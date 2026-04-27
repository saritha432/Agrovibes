import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = BottomTabBarProps & { onCreatePress: () => void };

const TAB_BG = "#1e1f1f";
const ACTIVE = "#ffffff";
const MUTED = "#b9bec3";

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

export function MainTabBar({ state, navigation, onCreatePress }: Props) {
  const insets = useSafeAreaInsets();
  // Web doesn't have a real safe-area inset; extra bottom padding makes alignment drift.
  const bottomPad = Platform.OS === "web" ? 0 : Math.max(insets.bottom, 10);

  const renderTab = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return null;
    const index = state.routes.indexOf(route);
    const isFocused = state.index === index;

    const onPress = () => {
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

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        style={styles.tabItem}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={route.name}
      >
        <Ionicons name={tabIcon(route.name, isFocused)} size={15} color={isFocused ? ACTIVE : MUTED} />
        <Text style={[styles.tabLabel, isFocused ? styles.tabLabelActive : null]} numberOfLines={1}>
          {route.name === "Services" ? "community" : route.name}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            const route = state.routes.find((r) => r.name === "Home");
            if (!route) return;
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!event.defaultPrevented) navigation.navigate("Home");
          }}
          style={styles.logoTab}
          accessibilityRole="button"
          accessibilityLabel="Home"
        >
          <Image source={require("../../assets/crop vibe.png")} style={styles.logoImage} resizeMode="contain" />
        </Pressable>
        {renderTab("Market")}
        <Pressable onPress={onCreatePress} style={styles.tabItem} accessibilityRole="button" accessibilityLabel="Create">
          <Ionicons name="add-circle-outline" size={15} color={ACTIVE} />
          <Text style={styles.tabLabel}>Create</Text>
        </Pressable>
        {renderTab("Services")}
        {renderTab("Profile")}
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
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 },
  logoTab: {
    width: 42,
    height: 32,
    borderRadius: 2,
    backgroundColor: "#2a2b2c",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4
  },
  logoImage: { width: 36, height: 14 },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    paddingVertical: 1
  },
  tabLabel: {
    marginTop: 2,
    fontSize: Platform.OS === "web" ? 8 : 9,
    lineHeight: 11,
    fontWeight: "500",
    color: MUTED
  },
  tabLabelActive: { color: ACTIVE, fontWeight: "600" }
});
