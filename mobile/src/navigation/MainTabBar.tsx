import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import React from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../localization/LanguageContext";
import { APP_BLACK, APP_LIME } from "../theme/appColors";

type Props = BottomTabBarProps & { onCreatePress: () => void };

const TAB_BG = APP_BLACK;
const MUTED = "#b9bec3";
const BRAND_ACCENT = APP_LIME;
const TAB_ICON_SIZE = 24;

type SvgIconModule = number | string | { uri?: string; default?: string };

const TAB_SVG_ICONS: Record<"Market" | "Learn" | "Services", { active: SvgIconModule; inactive: SvgIconModule }> = {
  Market: {
    active: require("../../assets/market-active.svg"),
    inactive: require("../../assets/market.svg")
  },
  Learn: {
    active: require("../../assets/learn-active.svg"),
    inactive: require("../../assets/learn.svg")
  },
  Services: {
    active: require("../../assets/community-active.svg"),
    inactive: require("../../assets/community.svg")
  }
};

function iconModuleToUri(module: SvgIconModule): string | null {
  if (typeof module === "string" && module.length > 0) return module;
  if (typeof module === "object" && module !== null) {
    if (typeof module.uri === "string" && module.uri.length > 0) return module.uri;
    if (typeof module.default === "string" && module.default.length > 0) return module.default;
  }
  if (typeof module === "number") {
    const resolver = (Image as unknown as { resolveAssetSource?: (asset: number) => { uri?: string } | undefined })
      .resolveAssetSource;
    if (typeof resolver !== "function") return null;
    const resolved = resolver(module);
    return resolved?.uri ?? null;
  }
  return null;
}

function fallbackIconName(routeName: "Market" | "Learn" | "Services", focused: boolean): keyof typeof Ionicons.glyphMap {
  if (routeName === "Market") return focused ? "storefront" : "storefront-outline";
  if (routeName === "Learn") return focused ? "book" : "book-outline";
  return focused ? "grid" : "grid-outline";
}

function TabSvgIcon({
  routeName,
  focused,
  size = 15
}: {
  routeName: "Market" | "Learn" | "Services";
  focused: boolean;
  size?: number;
}) {
  const module = focused ? TAB_SVG_ICONS[routeName].active : TAB_SVG_ICONS[routeName].inactive;
  const [uri, setUri] = React.useState<string | null>(() => iconModuleToUri(module));
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    const direct = iconModuleToUri(module);
    setUri(direct);
    setFailed(false);
    if (direct) return;

    let cancelled = false;
    void (async () => {
      try {
        const asset = Asset.fromModule(module as number | string);
        await asset.downloadAsync();
        const nextUri = asset.localUri ?? asset.uri;
        if (!cancelled && nextUri) setUri(nextUri);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [module]);

  if (!uri || failed) {
    return <Ionicons name={fallbackIconName(routeName, focused)} size={size} color={focused ? BRAND_ACCENT : MUTED} />;
  }

  if (Platform.OS === "web") {
    return React.createElement("img", {
      src: uri,
      alt: "",
      style: { width: size, height: size, display: "block", objectFit: "contain" },
      onError: () => setFailed(true)
    });
  }

  try {
    const { SvgUri } = require("react-native-svg") as typeof import("react-native-svg");
    return <SvgUri uri={uri} width={size} height={size} onError={() => setFailed(true)} />;
  } catch {
    return <Ionicons name={fallbackIconName(routeName, focused)} size={size} color={focused ? BRAND_ACCENT : MUTED} />;
  }
}

function tabIcon(routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap {
  switch (routeName) {
    case "Home":
      return focused ? "home" : "home-outline";
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
  const { t } = useLanguage();
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
  const learnFocused = isRouteFocused("Learn");

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
          accessibilityLabel={t("tabMarket")}
          label={t("tabMarket")}
        >
          <TabSvgIcon routeName="Market" focused={marketFocused} size={TAB_ICON_SIZE} />
        </TabSlot>

        <TabSlot focused={false} onPress={onCreatePress} accessibilityLabel={t("tabCreate")} label={t("tabCreate")}>
          <Ionicons name="add-circle-outline" size={TAB_ICON_SIZE} color={MUTED} />
        </TabSlot>

        <TabSlot
          focused={servicesFocused}
          onPress={() => pressRoute("Services")}
          accessibilityLabel={t("tabCommunity")}
          label={t("tabCommunity")}
        >
          <TabSvgIcon routeName="Services" focused={servicesFocused} size={TAB_ICON_SIZE} />
        </TabSlot>

        <TabSlot
          focused={learnFocused}
          onPress={() => pressRoute("Learn")}
          accessibilityLabel="Learn"
          label="Learn"
        >
          <TabSvgIcon routeName="Learn" focused={learnFocused} size={TAB_ICON_SIZE} />
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
