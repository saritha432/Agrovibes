import React from "react";
import { StyleSheet, View } from "react-native";
import { MarketAdsCarousel } from "../MarketAdsCarousel";
import { MarketProductRail } from "../shared/MarketProductRail";
import { MarketServiceCard } from "../shared/MarketServiceCard";
import { MARKET_SERVICE_CARDS, MONSOON_PRODUCTS } from "./marketAllConfig";
import { FeaturesWeekSection } from "./sections/FeaturesWeekSection";
import { MarketHeroSection } from "./sections/MarketHeroSection";
import { OffersCuratedSection } from "./sections/OffersCuratedSection";
import { WelcomeKisanBanner } from "./sections/WelcomeKisanBanner";

type MarketAllTabContentProps = {
  onNavigate: () => void;
};

export function MarketAllTabContent({ onNavigate }: MarketAllTabContentProps) {
  return (
    <View style={styles.root}>
      <MarketHeroSection onPress={onNavigate} />

      <FeaturesWeekSection onPress={onNavigate} />

      <OffersCuratedSection onPress={onNavigate} />

      <MarketAdsCarousel onAdPress={onNavigate} />

      <MarketProductRail
        title="Minimum"
        titleAccent="30% OFF"
        subtitle="On Monsoon Coolers"
        products={MONSOON_PRODUCTS}
        onPress={() => onNavigate()}
      />

      <WelcomeKisanBanner onPress={onNavigate} />

      {MARKET_SERVICE_CARDS.map((card) => (
        <MarketServiceCard key={card.id} card={card} onPress={() => onNavigate()} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: 28
  }
});
