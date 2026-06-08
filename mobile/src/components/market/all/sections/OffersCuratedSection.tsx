import React from "react";
import { ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { APP_LIME, APP_TEXT } from "../../../../theme/appColors";
import { MarketCardArt, type SvgModule } from "../../shared/marketAssetUtils";

const MARKET_TAB_ACTIVE_BG = "#303132";
const SEEDS_ART = require("../../../../../assets/market/seeds.svg");
const FERTILIZERS_ART = require("../../../../../assets/market/fertilizers.svg");

const OFFER_GAP = 8;
const OFFER_PAD = 16;
const OFFER_DAILY_WIDTH = 127;
const OFFER_DAILY_HEIGHT = 193;
const OFFER_DAILY_RADIUS = 10.71;
const OFFER_SMALL_WIDTH = 128;
const OFFER_SMALL_HEIGHT = 92;
const OFFER_SMALL_RADIUS = 10.88;

type OfferTile = {
  id: string;
  title: string;
  accent: string;
  image?: SvgModule | ImageSourcePropType;
  kind?: "svg" | "png";
  mix?: "seeds-fertilizer";
};

const OFFER_LARGE: OfferTile = {
  id: "daily",
  title: "Daily",
  accent: "Essential",
  image: require("../../../../../assets/market/daily-essentials.svg"),
  kind: "svg"
};

const OFFER_ROW_TOP: OfferTile[] = [
  {
    id: "low-price",
    title: "Lowest Prices",
    accent: "Fruits Veggies",
    image: require("../../../../../assets/market/low-price-veggies.svg"),
    kind: "svg"
  },
  { id: "seeds", title: "Top Picks", accent: "Seeds & Fertilizer", mix: "seeds-fertilizer" },
  { id: "soil", title: "Essentials", accent: "Soil Test Kits" },
  { id: "irrigation", title: "Irrigation", accent: "Drip Systems" }
];

const OFFER_ROW_BOTTOM: OfferTile[] = [
  {
    id: "dairy",
    title: "Top Picks On",
    accent: "Dairy, Bread & Eggs",
    image: require("../../../../../assets/market/dairy-products.svg"),
    kind: "svg"
  },
  {
    id: "tools",
    title: "Essential",
    accent: "Tools & Gear",
    image: require("../../../../../assets/market/essentials.svg"),
    kind: "svg"
  },
  { id: "storage", title: "Storage", accent: "Cold Storage" },
  { id: "rental", title: "Rental", accent: "Machinery" }
];

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
    <Pressable style={[styles.offerTile, { width, height }, cardStyle]} onPress={onPress}>
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

export function OffersCuratedSection({ onPress }: { onPress: () => void }) {
  const scrollContentW = OFFER_SMALL_WIDTH * 4 + OFFER_GAP * 3;

  return (
    <View style={styles.offersSection}>
      <Text style={styles.sectionTitle}>offers curated for you</Text>
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

const styles = StyleSheet.create({
  offersSection: {
    marginTop: 16,
    paddingHorizontal: OFFER_PAD
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "700",
    color: APP_TEXT
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
