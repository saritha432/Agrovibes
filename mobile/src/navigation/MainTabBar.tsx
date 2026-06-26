import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import React from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { UserAvatar } from "../components/UserAvatar";
import { useNotificationPanel } from "../context/NotificationPanelContext";
import { useLanguage } from "../localization/LanguageContext";
import { APP_BLACK, APP_LIME } from "../theme/appColors";
import { stripLegacyCloudinaryUrl } from "../utils/mediaUrls";

type Props = BottomTabBarProps & { onCreatePress: () => void; createFocused?: boolean };

const TAB_BG = APP_BLACK;
const MUTED = "#b9bec3";
const BRAND_ACCENT = APP_LIME;
const TAB_ICON_SIZE = 24;

const BOTTOM_TAB_ICONS = {
  search: {
    active: require("../../assets/bottom-icons/search-active.svg"),
    inactive: require("../../assets/bottom-icons/search.svg")
  },
  messages: {
    active: require("../../assets/bottom-icons/chat-active.svg"),
    inactive: require("../../assets/bottom-icons/chat.svg")
  },
  create: {
    active: require("../../assets/bottom-icons/create-active.svg"),
    inactive: require("../../assets/bottom-icons/create.svg")
  },
  profile: {
    active: require("../../assets/bottom-icons/profile-active.svg"),
    inactive: require("../../assets/bottom-icons/profile.svg")
  }
} as const;

type SvgIconModule = number | string | { uri?: string; default?: string };

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

function TabSvgIcon({
  focused,
  icons,
  size = TAB_ICON_SIZE,
  fallbackName
}: {
  focused: boolean;
  icons: { active: SvgIconModule; inactive: SvgIconModule };
  size?: number;
  fallbackName?: keyof typeof Ionicons.glyphMap;
}) {
  const module = focused ? icons.active : icons.inactive;
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
    return (
      <Ionicons
        name={fallbackName ?? (focused ? "ellipse" : "ellipse-outline")}
        size={size}
        color={focused ? BRAND_ACCENT : MUTED}
      />
    );
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
    return (
      <Ionicons
        name={fallbackName ?? (focused ? "ellipse" : "ellipse-outline")}
        size={size}
        color={focused ? BRAND_ACCENT : MUTED}
      />
    );
  }
}

function TabCreateIcon({ focused, size = TAB_ICON_SIZE }: { focused: boolean; size?: number }) {
  return <TabSvgIcon focused={focused} icons={BOTTOM_TAB_ICONS.create} size={size} fallbackName="add-circle-outline" />;
}

function TabProfileIcon({ focused }: { focused: boolean }) {
  const { user } = useAuth();
  const avatarUri = stripLegacyCloudinaryUrl(user?.avatarUrl) || "";
  const displayName = user?.fullName || user?.username || "U";

  if (!avatarUri) {
    return (
      <TabSvgIcon
        focused={focused}
        icons={BOTTOM_TAB_ICONS.profile}
        size={TAB_ICON_SIZE}
        fallbackName={focused ? "person-circle" : "person-circle-outline"}
      />
    );
  }

  const ringSize = TAB_ICON_SIZE;
  const photoSize = focused ? ringSize - 4 : ringSize;

  return (
    <View
      style={[
        styles.profileAvatarRing,
        { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
        focused ? styles.profileAvatarRingFocused : styles.profileAvatarRingIdle
      ]}
    >
      <UserAvatar
        uri={avatarUri}
        name={displayName}
        size={photoSize}
        borderRadius={photoSize / 2}
        fallbackBackgroundColor="#1f2328"
        initialsColor={BRAND_ACCENT}
      />
    </View>
  );
}

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

type TabSlotProps = {
  focused: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  label?: string;
  children: React.ReactNode;
  showBadge?: number;
  iconVariant?: "default" | "logo";
};

function TabSlot({
  focused,
  onPress,
  accessibilityLabel,
  label,
  children,
  showBadge = 0,
  iconVariant = "default"
}: TabSlotProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabItem, focused ? styles.tabItemFocused : null]}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.iconWrap}>
        <View style={iconVariant === "logo" ? styles.logoIconBox : styles.tabIconBox}>{children}</View>
        {showBadge > 0 ? <CountBadge count={showBadge} /> : null}
      </View>
      {label ? (
        <Text style={[styles.tabLabel, focused ? styles.tabLabelActive : null]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function MainTabBar({ state, navigation, onCreatePress, createFocused = false }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 0 : Math.max(insets.bottom, 10);
  const { messageUnreadCount } = useNotificationPanel();

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
    if (!isFocused) navigation.navigate(route.name);
  };

  const homeFocused = isRouteFocused("Home");
  const searchFocused = isRouteFocused("Search");
  const messagesFocused = isRouteFocused("Messages");
  const profileFocused = isRouteFocused("Profile");

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={styles.row}>
        <TabSlot
          focused={homeFocused}
          onPress={() => pressRoute("Home")}
          accessibilityLabel="Home"
          iconVariant="logo"
        >
          <Image
            source={require("../../assets/crop vibe.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </TabSlot>

        <TabSlot
          focused={searchFocused}
          onPress={() => pressRoute("Search")}
          accessibilityLabel="Discover"
          label="Discover"
        >
          <TabSvgIcon focused={searchFocused} icons={BOTTOM_TAB_ICONS.search} fallbackName="search-outline" />
        </TabSlot>

        <TabSlot
          focused={createFocused}
          onPress={onCreatePress}
          accessibilityLabel={t("tabCreate")}
          label={t("tabCreate")}
        >
          <TabCreateIcon focused={createFocused} />
        </TabSlot>

        <TabSlot
          focused={messagesFocused}
          onPress={() => pressRoute("Messages")}
          accessibilityLabel="Chat"
          label="Chat"
          showBadge={messageUnreadCount}
        >
          <TabSvgIcon focused={messagesFocused} icons={BOTTOM_TAB_ICONS.messages} fallbackName="chatbubble-outline" />
        </TabSlot>

        {/* Was Learn */}
        <TabSlot focused={profileFocused} onPress={() => pressRoute("Profile")} accessibilityLabel="Profile" label="Profile">
          <TabProfileIcon focused={profileFocused} />
        </TabSlot>

        {/*
        <TabSlot
          focused={marketFocused}
          onPress={() => pressRoute("Market")}
          accessibilityLabel={t("tabMarket")}
          label={t("tabMarket")}
        >
          <TabSvgIcon routeName="Market" focused={marketFocused} size={TAB_ICON_SIZE} />
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
        */}
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
  iconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center"
  },
  tabIconBox: {
    width: TAB_ICON_SIZE,
    height: TAB_ICON_SIZE,
    alignItems: "center",
    justifyContent: "center"
  },
  logoIconBox: {
    width: 66,
    height: 17.3271484375,
    alignItems: "center",
    justifyContent: "center"
  },
  logoImage: {
    width: 66,
    height: 17.3271484375,
    opacity: 1
  },
  profileAvatarRing: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  profileAvatarRingFocused: {
    borderWidth: 2,
    borderColor: BRAND_ACCENT
  },
  profileAvatarRingIdle: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)"
  },
  tabLabel: {
    marginTop: 2,
    fontSize: Platform.OS === "web" ? 8 : 9,
    lineHeight: 11,
    fontWeight: "500",
    color: MUTED
  },
  tabLabelActive: { color: BRAND_ACCENT, fontWeight: "600" },
  badge: {
    position: "absolute",
    top: -5,
    right: -8,
    minWidth: 14,
    height: 14,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: TAB_BG
  },
  badgeRound: {
    width: 14,
    borderRadius: 7,
    paddingHorizontal: 0
  },
  badgeWide: {
    borderRadius: 7,
    paddingHorizontal: 3
  },
  badgeText: {
    color: APP_BLACK,
    fontSize: 8,
    fontWeight: "800",
    lineHeight: 10
  }
});
