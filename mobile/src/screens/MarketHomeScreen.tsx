import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MarketAllTabContent } from "../components/market/all/MarketAllTabContent";
import { MarketPlaceholderTab } from "../components/market/MarketPlaceholderTab";
import { MarketSvgIcon, type SvgModule } from "../components/market/shared/marketAssetUtils";
import type { MarketStackParamList } from "../navigation/MarketStackNavigator";
import { AppTopBar } from "../components/AppTopBar";
import {
  APP_BLACK,
  APP_LIME,
  APP_SURFACE,
  APP_TEXT,
  APP_TEXT_MUTED
} from "../theme/appColors";

type Nav = NativeStackNavigationProp<MarketStackParamList, "MarketplaceHome">;

export type MarketTabId = "All" | "Store" | "Rent" | "Buy" | "Transport" | "Services";

const MARKET_TAB_ACTIVE_BG = "#303132";

const MARKET_TABS: { id: MarketTabId; label: string; icon: SvgModule }[] = [
  { id: "All", label: "All", icon: require("../../assets/market/All.svg") },
  { id: "Store", label: "Store", icon: require("../../assets/market/store.svg") },
  { id: "Rent", label: "Rent", icon: require("../../assets/market/rent.svg") },
  { id: "Buy", label: "Buy", icon: require("../../assets/market/buy.svg") },
  { id: "Transport", label: "Transport", icon: require("../../assets/market/transport.svg") },
  { id: "Services", label: "Services", icon: require("../../assets/market/services.svg") }
];

const SEARCH_ICON = require("../../assets/search-icon.svg");
const MIC_ICON = require("../../assets/market/mic-icon.svg");

export function MarketHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [activeTab, setActiveTab] = useState<MarketTabId>("All");
  const [search, setSearch] = useState("");

  const openStore = () => navigation.navigate("MarketListings");

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.marketChrome}>
        <AppTopBar showSearch={false} showMessages={false} />

        <View style={styles.searchRow}>
          <MarketSvgIcon module={SEARCH_ICON} size={20} active={false} fallbackIcon="search-outline" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search Seeds..."
            placeholderTextColor={APP_TEXT_MUTED}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={openStore}
          />
          <Pressable hitSlop={8} accessibilityLabel="Voice search">
            <MarketSvgIcon module={MIC_ICON} size={22} active={false} fallbackIcon="mic-outline" />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {MARKET_TABS.map((tab) => {
            const on = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[styles.tabItem, on ? styles.tabItemActive : null]}
                onPress={() => setActiveTab(tab.id)}
              >
                <MarketSvgIcon module={tab.icon} size={30} active={on} />
                <Text style={[styles.tabLabel, on ? styles.tabLabelOn : null]}>{tab.label}</Text>
                {on ? <View style={styles.tabUnderline} /> : <View style={styles.tabUnderlineSpacer} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.marketScroll}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {activeTab === "All" ? (
          <MarketAllTabContent onNavigate={openStore} />
        ) : (
          <MarketPlaceholderTab tabLabel={activeTab} onBrowse={openStore} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: APP_BLACK,
    ...(Platform.OS === "web" ? { overflow: "hidden" as const } : null)
  },
  marketChrome: {
    flexShrink: 0,
    backgroundColor: APP_BLACK,
    zIndex: 1
  },
  marketScroll: {
    flex: 1,
    minHeight: 0
  },
  scrollContent: {
    flexGrow: 1
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 18,
    backgroundColor: APP_SURFACE,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  searchInput: {
    flex: 1,
    color: APP_TEXT,
    fontSize: 15,
    padding: 0
  },
  tabsRow: {
    paddingHorizontal: 12,
    gap: 4,
    paddingBottom: 8
  },
  tabItem: {
    width: 72,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10
  },
  tabItemActive: {
    backgroundColor: MARKET_TAB_ACTIVE_BG
  },
  tabLabel: {
    marginTop: 6,
    fontSize: 12,
    color: APP_TEXT_MUTED,
    fontWeight: "500"
  },
  tabLabelOn: {
    color: APP_LIME,
    fontWeight: "600"
  },
  tabUnderline: {
    marginTop: 6,
    alignSelf: "stretch",
    height: 3,
    borderRadius: 2,
    backgroundColor: APP_LIME
  },
  tabUnderlineSpacer: {
    marginTop: 6,
    height: 3
  }
});
