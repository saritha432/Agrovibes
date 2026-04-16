import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = BottomTabBarProps & { onCreatePress: () => void };

const GREEN = "#0a9f46";
const MUTED = "#6b7280";

function tabIcon(routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap {
  switch (routeName) {
    case "Home":
      return focused ? "home" : "home-outline";
    case "Marketplace":
      return focused ? "storefront" : "storefront-outline";
    case "Learn":
      return focused ? "book" : "book-outline";
    case "Profile":
      return focused ? "person" : "person-outline";
    default:
      return "ellipse-outline";
  }
}

export function MainTabBar({ state, navigation, onCreatePress }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);

  const renderTab = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return null;
    const index = state.routes.indexOf(route);
    const isFocused = state.index === index;

    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
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
        <Ionicons name={tabIcon(route.name, isFocused)} size={22} color={isFocused ? GREEN : MUTED} />
        <Text style={[styles.tabLabel, isFocused ? styles.tabLabelActive : null]} numberOfLines={1}>
          {route.name}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={styles.row}>
        {renderTab("Home")}
        {renderTab("Marketplace")}
        <View style={styles.fabColumn}>
          <Pressable onPress={onCreatePress} style={styles.fab} accessibilityRole="button" accessibilityLabel="Create">
            <Ionicons name="add" size={30} color="#fff" />
          </Pressable>
          <Text style={styles.fabLabel}>Create+</Text>
        </View>
        {renderTab("Learn")}
        {renderTab("Profile")}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "#fff", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#dde5e2", paddingTop: 6 },
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around" },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 2, minWidth: 0 },
  tabLabel: { marginTop: 4, fontSize: 10, fontWeight: "600", color: MUTED },
  tabLabelActive: { color: GREEN },
  fabColumn: { width: 76, alignItems: "center", justifyContent: "flex-end", marginHorizontal: 2 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 8
  },
  fabLabel: { marginTop: 4, fontSize: 11, fontWeight: "700", color: GREEN }
});
