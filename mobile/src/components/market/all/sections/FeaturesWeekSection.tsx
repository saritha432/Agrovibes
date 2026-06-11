import React from "react";
import { ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { APP_LIME, APP_TEXT } from "../../../../theme/appColors";
import { MarketCardArt, type SvgModule } from "../../shared/marketAssetUtils";

const MARKET_TILE_BG = "#303132";
const FEATURE_CARD_WIDTH = 106;
const FEATURE_CARD_HEIGHT = 120;
const FEATURE_TITLE_HEIGHT = 56;
const FEATURE_ART_HEIGHT = FEATURE_CARD_HEIGHT - FEATURE_TITLE_HEIGHT;

type FeatureCard = {
  id: string;
  accent: string;
  label: string;
  image: SvgModule | ImageSourcePropType;
  kind: "svg" | "png";
  categoryId?: string;
};

const FEATURE_CARDS: FeatureCard[] = [
  {
    id: "kharif",
    accent: "Kharif",
    label: "Season",
    image: require("../../../../../assets/market/season-items.png"),
    kind: "png",
    categoryId: "seeds"
  },
  {
    id: "tractor",
    accent: "Tractor",
    label: "Rental",
    image: require("../../../../../assets/market/tractor-rental.png"),
    kind: "png",
    categoryId: "browse-book"
  },
  {
    id: "drone",
    accent: "Drone",
    label: "Spraying",
    image: require("../../../../../assets/market/drone-spraying.png"),
    kind: "png",
    categoryId: "crop-spray"
  },
  {
    id: "gov",
    accent: "Gov.",
    label: "Schemes",
    image: require("../../../../../assets/market/gov-schemes.png"),
    kind: "png",
    categoryId: "subsidies"
  }
];

type FeaturesWeekSectionProps = {
  onPress: () => void;
  onCategoryPress?: (categoryId: string) => void;
};

export function FeaturesWeekSection({ onPress, onCategoryPress }: FeaturesWeekSectionProps) {
  return (
    <>
      <Text style={styles.sectionTitle}>Features this week</Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.featuresRow}
      >
        {FEATURE_CARDS.map((card) => (
          <Pressable
            key={card.id}
            style={styles.featureCard}
            onPress={() => {
              if (card.categoryId && onCategoryPress) {
                onCategoryPress(card.categoryId);
                return;
              }
              onPress();
            }}
          >
            <View style={styles.featureTitleBlock}>
              <Text style={styles.featureAccent}>{card.accent}</Text>
              <Text style={styles.featureLabel}>{card.label}</Text>
            </View>
            <MarketCardArt
              image={card.image}
              kind={card.kind}
              width={FEATURE_CARD_WIDTH}
              height={FEATURE_ART_HEIGHT}
            />
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: MARKET_TILE_BG,
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
  }
});
