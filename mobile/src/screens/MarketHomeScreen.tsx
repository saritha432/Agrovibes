import { Ionicons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import {
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MarketStackParamList } from "../navigation/MarketStackNavigator";
import { AppTopBar } from "../components/AppTopBar";
import {
  APP_BLACK,
  APP_LIME,
  APP_SURFACE,
  APP_TEXT,
  APP_TEXT_MUTED,
  APP_TEXT_ON_LIME
} from "../theme/appColors";

type Nav = NativeStackNavigationProp<MarketStackParamList, "MarketplaceHome">;

type MarketTabId = "All" | "Store" | "Rent" | "Buy" | "Transport" | "Services";

type SvgModule = number | string | { uri?: string; default?: string };

const MARKET_TABS: { id: MarketTabId; label: string; icon: SvgModule }[] = [
  { id: "All", label: "All", icon: require("../../assets/market/All.svg") },
  { id: "Store", label: "Store", icon: require("../../assets/market/store.svg") },
  { id: "Rent", label: "Rent", icon: require("../../assets/market/rent.svg") },
  { id: "Buy", label: "Buy", icon: require("../../assets/market/buy.svg") },
  { id: "Transport", label: "Transport", icon: require("../../assets/market/transport.svg") },
  { id: "Services", label: "Services", icon: require("../../assets/market/services.svg") }
];

type FeatureCard = {
  id: string;
  accent: string;
  label: string;
  image: SvgModule | ImageSourcePropType;
  kind: "svg" | "png";
  imageFit?: "meet" | "slice";
};

const FEATURE_CARDS: FeatureCard[] = [
  {
    id: "kharif",
    accent: "Kharif",
    label: "Season",
    image: require("../../assets/market/season-items.svg"),
    kind: "svg",
    imageFit: "meet"
  },
  {
    id: "tractor",
    accent: "Tractor",
    label: "Rental",
    image: require("../../assets/market/tractor-rental.png"),
    kind: "png",
    imageFit: "meet"
  },
  {
    id: "drone",
    accent: "Drone",
    label: "Spraying",
    image: require("../../assets/market/drone-spraying.png"),
    kind: "png",
    imageFit: "meet"
  },
  {
    id: "gov",
    accent: "Gov.",
    label: "Schemes",
    image: require("../../assets/market/gov-schemes.png"),
    kind: "png",
    imageFit: "meet"
  }
];

const MARKET_TAB_ACTIVE_BG = "#303132";
const FEATURE_CARD_WIDTH = 106;
const FEATURE_CARD_HEIGHT = 120;
const FEATURE_TITLE_HEIGHT = 56; // paddingTop(14) + two lines of text(~42)
const FEATURE_ART_HEIGHT = FEATURE_CARD_HEIGHT - FEATURE_TITLE_HEIGHT; // 144

type OfferTile = {
  id: string;
  title: string;
  accent: string;
  image?: SvgModule | ImageSourcePropType;
  kind?: "svg" | "png";
  mix?: "seeds-fertilizer";
};

const SEEDS_ART = require("../../assets/market/seeds.svg");
const FERTILIZERS_ART = require("../../assets/market/fertilizers.svg");

const OFFER_LARGE: OfferTile = {
  id: "daily",
  title: "Daily",
  accent: "Essential",
  image: require("../../assets/market/daily-essentials.svg"),
  kind: "svg"
};

const OFFER_ROW_TOP: OfferTile[] = [
  {
    id: "low-price",
    title: "Lowest Prices",
    accent: "Fruits Veggies",
    image: require("../../assets/market/low-price-veggies.svg"),
    kind: "svg"
  },
  {
    id: "seeds",
    title: "Top Picks",
    accent: "Seeds & Fertilizer",
    mix: "seeds-fertilizer"
  },
  { id: "soil", title: "Essentials", accent: "Soil Test Kits" },
  { id: "irrigation", title: "Irrigation", accent: "Drip Systems" }
];

const OFFER_ROW_BOTTOM: OfferTile[] = [
  {
    id: "dairy",
    title: "Top Picks On",
    accent: "Dairy, Bread & Eggs",
    image: require("../../assets/market/dairy-products.svg"),
    kind: "svg"
  },
  { id: "tools", title: "Essential", accent: "Tools & Gear",
    image: require("../../assets/market/essentials.svg"), kind: "svg" },
  { id: "storage", title: "Storage", accent: "Cold Storage" },
  { id: "rental", title: "Rental", accent: "Machinery" }
];

const OFFER_GAP = 8;
const OFFER_PAD = 16;
const OFFER_DAILY_WIDTH = 127;
const OFFER_DAILY_HEIGHT = 193;
const OFFER_DAILY_RADIUS = 10.71;
const OFFER_SMALL_WIDTH = 128;
const OFFER_SMALL_HEIGHT = 92;
const OFFER_SMALL_RADIUS = 10.88;

const FARM_ILLUSTRATION = require("../../assets/market/farm-illustration.svg");
const SEARCH_ICON = require("../../assets/search-icon.svg");
const MIC_ICON = require("../../assets/market/mic-icon.svg");

function moduleToUri(module: SvgModule): string | null {
  if (typeof module === "string" && module.length > 0) return module;
  if (typeof module === "object" && module !== null) {
    if (typeof module.uri === "string" && module.uri.length > 0) return module.uri;
    if (typeof module.default === "string" && module.default.length > 0) return module.default;
  }
  if (typeof module === "number") {
    const resolver = (Image as unknown as { resolveAssetSource?: (asset: number) => { uri?: string } | undefined })
      .resolveAssetSource;
    if (typeof resolver !== "function") return null;
    return resolver(module)?.uri ?? null;
  }
  return null;
}

function MarketSvgIcon({
  module,
  size,
  active,
  fallbackIcon = "ellipse-outline"
}: {
  module: SvgModule;
  size: number;
  active: boolean;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
}) {
  const [uri, setUri] = useState<string | null>(() => moduleToUri(module));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const direct = moduleToUri(module);
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

  if (failed || !uri) {
    return (
      <Ionicons
        name={fallbackIcon}
        size={size}
        color={active ? APP_LIME : APP_TEXT_MUTED}
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
    return <Ionicons name={fallbackIcon} size={size} color={active ? APP_LIME : APP_TEXT_MUTED} />;
  }
}

function useAssetUri(module: SvgModule | ImageSourcePropType) {
  const [uri, setUri] = useState<string | null>(() => moduleToUri(module as SvgModule));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const direct = moduleToUri(module as SvgModule);
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

  return { uri, failed, setFailed };
}

function MarketCardArt({
  image,
  kind,
  width,
  height
}: {
  image: SvgModule | ImageSourcePropType;
  kind: "svg" | "png";
  width: number;
  height: number;
}) {
  const { uri, failed, setFailed } = useAssetUri(image);

  if (kind === "png") {
    return (
      <Image source={image as ImageSourcePropType} style={{ width, height }} resizeMode="contain" />
    );
  }

  if (failed || !uri) {
    return <View style={{ width, height }} />;
  }

  if (Platform.OS === "web") {
    return React.createElement("img", {
      src: uri,
      alt: "",
      style: {
        width,
        height,
        display: "block",
        objectFit: "contain",
        objectPosition: "center bottom"
      },
      onError: () => setFailed(true)
    });
  }

  try {
    const { SvgUri } = require("react-native-svg") as typeof import("react-native-svg");
    return <SvgUri uri={uri} width={width} height={height} preserveAspectRatio="xMidYMax meet" />;
  } catch {
    return <View style={{ width, height }} />;
  }
}

function FeatureCardArt({ card }: { card: FeatureCard }) {
  return (
    <MarketCardArt
      image={card.image}
      kind={card.kind}
      width={FEATURE_CARD_WIDTH}
      height={FEATURE_ART_HEIGHT}
    />
  );
}

function SeedsFertilizerMixArt({ width, height }: { width: number; height: number }) {
  const seedW = Math.round(width * 0.62);
  const seedH = Math.round(height * 0.88);
  const fertW = Math.round(width * 0.72);
  const fertH = Math.round(height * 0.98);

  return (
    <View style={[styles.offerMixArt, { width, height }]}>
      <View style={[styles.offerMixLayer, { left: -2, bottom: 0, width: seedW, height: seedH, zIndex: 1 }]}>
        <MarketCardArt image={SEEDS_ART} kind="svg" width={seedW} height={seedH} />
      </View>
      <View style={[styles.offerMixLayer, { right: -4, bottom: 0, width: fertW, height: fertH, zIndex: 2 }]}>
        <MarketCardArt image={FERTILIZERS_ART} kind="svg" width={fertW} height={fertH} />
      </View>
    </View>
  );
}

function OfferTileCard({
  tile,
  width,
  height,
  large,
  onPress,
  cardStyle
}: {
  tile: OfferTile;
  width: number;
  height: number;
  large?: boolean;
  onPress: () => void;
  cardStyle?: object;
}) {
  const titleH = large ? 52 : 40;
  const artH = height - titleH;

  return (
    <Pressable
      style={[styles.offerTile, { width, height }, cardStyle]}
      onPress={onPress}
    >
      <View style={[styles.offerTitleBlock, large ? styles.offerTitleBlockLarge : null]}>
        <Text style={[styles.offerTitle, large ? styles.offerTitleLarge : null]} numberOfLines={2}>
          {tile.title}
        </Text>
        <Text style={[styles.offerAccent, large ? styles.offerAccentLarge : null]} numberOfLines={2}>
          {tile.accent}
        </Text>
      </View>
      {tile.mix === "seeds-fertilizer" ? (
        <SeedsFertilizerMixArt width={width} height={artH} />
      ) : tile.image && tile.kind ? (
        <MarketCardArt image={tile.image} kind={tile.kind} width={width} height={artH} />
      ) : null}
    </Pressable>
  );
}

function OffersCuratedSection({ onPress }: { onPress: () => void }) {
  const scrollContentW = OFFER_SMALL_WIDTH * 4 + OFFER_GAP * 3;

  return (
    <View style={styles.offersSection}>
      <Text style={[styles.sectionTitle, styles.offerSectionTitle]}>offers curated for you</Text>
      <View style={styles.offersLayout}>
        <OfferTileCard
          tile={OFFER_LARGE}
          width={OFFER_DAILY_WIDTH}
          height={OFFER_DAILY_HEIGHT}
          large
          onPress={onPress}
          cardStyle={styles.offerTileDaily}
        />
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.offersScroll}
          contentContainerStyle={{ width: scrollContentW }}
        >
          <View style={styles.offersRight}>
            <View style={styles.offersRow}>
              {OFFER_ROW_TOP.map((tile) => (
                <OfferTileCard
                  key={tile.id}
                  tile={tile}
                  width={OFFER_SMALL_WIDTH}
                  height={OFFER_SMALL_HEIGHT}
                  onPress={onPress}
                  cardStyle={styles.offerTileSmall}
                />
              ))}
            </View>
            <View style={styles.offersRow}>
              {OFFER_ROW_BOTTOM.map((tile) => (
                <OfferTileCard
                  key={tile.id}
                  tile={tile}
                  width={OFFER_SMALL_WIDTH}
                  height={OFFER_SMALL_HEIGHT}
                  onPress={onPress}
                  cardStyle={styles.offerTileSmall}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function FarmIllustration({ width }: { width: number }) {
  const artHeight = Math.round(width * (210 / 429));
  const [uri, setUri] = useState<string | null>(() => moduleToUri(FARM_ILLUSTRATION));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const direct = moduleToUri(FARM_ILLUSTRATION);
    setUri(direct);
    setFailed(false);
    if (direct) return;

    let cancelled = false;
    void (async () => {
      try {
        const asset = Asset.fromModule(FARM_ILLUSTRATION as number);
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
  }, []);

  if (failed || !uri) return null;

  if (Platform.OS === "web") {
    return React.createElement("img", {
      src: uri,
      alt: "",
      style: {
        width,
        height: artHeight,
        display: "block",
        objectFit: "cover",
        objectPosition: "center bottom",
        pointerEvents: "none"
      },
      onError: () => setFailed(true)
    });
  }

  try {
    const { SvgUri } = require("react-native-svg") as typeof import("react-native-svg");
    return (
      <View style={[styles.heroArtWrap, { width, height: artHeight }]} pointerEvents="none">
        <SvgUri uri={uri} width={width} height={artHeight} preserveAspectRatio="xMidYMax meet" />
      </View>
    );
  } catch {
    return null;
  }
}

export function MarketHomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [activeTab, setActiveTab] = useState<MarketTabId>("All");
  const [search, setSearch] = useState("");
  const heroArtWidth = windowWidth - 32;

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
                onPress={() => {
                  setActiveTab(tab.id);
                  if (tab.id === "Store" || tab.id === "Buy") openStore();
                }}
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
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroTitle}>
                Khet Se{"\n"}
                <Text style={styles.heroTitleAccent}>Ghar Tak</Text>
              </Text>
              <Text style={styles.heroSubtitle}>Bhoomi. Bazaar. Barakath.</Text>
            </View>
            <Pressable style={styles.shopBtn} onPress={openStore}>
              <Text style={styles.shopBtnText}>Shop Now</Text>
            </Pressable>
          </View>
          <FarmIllustration width={heroArtWidth} />
        </View>

        <Text style={styles.sectionTitle}>Features this week</Text>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.featuresRow}
        >
          {FEATURE_CARDS.map((card) => (
            <Pressable key={card.id} style={styles.featureCard} onPress={openStore}>
              <View style={styles.featureTitleBlock}>
                <Text style={styles.featureAccent}>{card.accent}</Text>
                <Text style={styles.featureLabel}>{card.label}</Text>
              </View>
              <FeatureCardArt card={card} />
            </Pressable>
          ))}
        </ScrollView>

        <OffersCuratedSection onPress={openStore} />
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
    paddingBottom: 28
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
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: APP_BLACK,
    overflow: "hidden"
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 12
  },
  heroTextBlock: {
    flex: 1,
    minWidth: 0
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    color: APP_TEXT
  },
  heroTitleAccent: {
    color: APP_LIME
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: APP_TEXT_MUTED
  },
  shopBtn: {
    marginTop: 4,
    backgroundColor: APP_LIME,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 10
  },
  shopBtnText: {
    color: APP_TEXT_ON_LIME,
    fontWeight: "700",
    fontSize: 14
  },
  heroArtWrap: {
    alignSelf: "center",
    marginTop: 4
  },
  sectionTitle: {
    marginTop: 22,
    marginHorizontal: 16,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "700",
    color: APP_TEXT
  },
  featuresRow: {
    paddingHorizontal: 16,
    gap: 12
  },
  featureCard: {
    width: FEATURE_CARD_WIDTH,
    height: FEATURE_CARD_HEIGHT,
    borderRadius: 12,
    backgroundColor: MARKET_TAB_ACTIVE_BG,
    overflow: "hidden",
    paddingTop: 14
  },
  featureTitleBlock: {
    alignItems: "center",
    alignSelf: "stretch",
    paddingHorizontal: 4,
    paddingBottom: 8
  },
  featureAccent: {
    fontSize: 12,
    lineHeight: 13,
    fontWeight: "600",
    color: APP_LIME,
    textAlign: "center"
  },
  featureLabel: {
    fontSize: 12,
    lineHeight: 13,
    fontWeight: "600",
    color: APP_TEXT,
    textAlign: "center"
  },
  featureArtSlot: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end"
  },
  featureImage: {
    width: "100%",
    flex: 1
  },
  featureImagePlaceholder: {
    flex: 1,
    width: "100%"
  },
  offersSection: {
    marginTop: 8,
    paddingHorizontal: OFFER_PAD
  },
  offerSectionTitle: {
    marginHorizontal: 0
  },
  offersLayout: {
    flexDirection: "row",
    gap: OFFER_GAP,
    alignItems: "flex-start"
  },
  offersScroll: {
    flex: 1,
    minWidth: 0
  },
  offersRight: {
    gap: OFFER_GAP
  },
  offersRow: {
    flexDirection: "row",
    gap: OFFER_GAP
  },
  offerTile: {
    borderRadius: 12,
    backgroundColor: MARKET_TAB_ACTIVE_BG,
    overflow: "hidden"
  },
  offerTileDaily: {
    borderRadius: OFFER_DAILY_RADIUS
  },
  offerTileSmall: {
    borderRadius: OFFER_SMALL_RADIUS
  },
  offerTitleBlock: {
    alignItems: "center",
    paddingTop: 8,
    paddingHorizontal: 4
  },
  offerTitleBlockLarge: {
    paddingTop: 12
  },
  offerTitle: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "600",
    color: APP_TEXT,
    textAlign: "center"
  },
  offerTitleLarge: {
    fontSize: 14,
    lineHeight: 16
  },
  offerAccent: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "700",
    color: APP_LIME,
    textAlign: "center"
  },
  offerAccentLarge: {
    fontSize: 14,
    lineHeight: 16
  },
  offerMixArt: {
    position: "relative",
    overflow: "hidden"
  },
  offerMixLayer: {
    position: "absolute"
  }
});
