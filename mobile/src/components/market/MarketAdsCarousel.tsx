import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import {
  APP_BLACK,
  APP_LIME,
  APP_SURFACE,
  APP_TEXT,
  APP_TEXT_MUTED
} from "../../theme/appColors";

type MarketAd = {
  id: string;
  variant: "light" | "dark";
  title: string;
  titleAccent?: string;
  subtitle: string;
};

const AUTOPLAY_MS = 5000;
const CARD_GAP = 12;
const SIDE_PAD = 16;
const BANNER_H = 132;

const MARKET_ADS: MarketAd[] = [
  {
    id: "farm-home-light",
    variant: "light",
    title: "Khet Se Ghar Tak",
    subtitle: "Bhoomi. Bazaar. Barakath."
  },
  {
    id: "farm-home-dark",
    variant: "dark",
    title: "Khet Se",
    titleAccent: "Ghar Tak",
    subtitle: "Bhoomi. Bazaar. Barakath."
  },
  {
    id: "delivery-light",
    variant: "light",
    title: "Fresh from Farm",
    subtitle: "Same-day delivery on essentials."
  },
  {
    id: "schemes-dark",
    variant: "dark",
    title: "Govt.",
    titleAccent: "Schemes",
    subtitle: "Subsidies & benefits for you."
  }
];

function LightAdCard({ ad, width, onPress }: { ad: MarketAd; width: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <View style={[styles.card, styles.cardLight, { width, height: BANNER_H }]}>
        <View style={styles.gridOverlay} pointerEvents="none">
          {Array.from({ length: 6 }).map((_, row) => (
            <View key={`r-${row}`} style={styles.gridRow}>
              {Array.from({ length: 8 }).map((__, col) => (
                <View key={`c-${col}`} style={styles.gridCell} />
              ))}
            </View>
          ))}
        </View>
        <LinearGradient
          colors={["transparent", "rgba(201, 255, 53, 0.18)"]}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={styles.lightGlow}
          pointerEvents="none"
        />
        <View style={styles.cardTextWrap}>
          <Text style={styles.lightTitle} numberOfLines={2}>
            {ad.title}
          </Text>
          <Text style={styles.lightSubtitle} numberOfLines={2}>
            {ad.subtitle}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function DarkAdCard({ ad, width, onPress }: { ad: MarketAd; width: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <View style={[styles.card, styles.cardDark, { width, height: BANNER_H }]}>
        <View style={styles.cardTextWrap}>
          <Text style={styles.darkTitle} numberOfLines={2}>
            {ad.title}
            {ad.titleAccent ? (
              <Text style={styles.darkTitleAccent}>
                {"\n"}
                {ad.titleAccent}
              </Text>
            ) : null}
          </Text>
          <Text style={styles.darkSubtitle} numberOfLines={2}>
            {ad.subtitle}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

type MarketAdsCarouselProps = {
  onAdPress?: () => void;
};

export function MarketAdsCarousel({ onAdPress }: MarketAdsCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const indexRef = useRef(0);
  const userDraggingRef = useRef(false);
  const pauseUntilRef = useRef(0);

  const cardWidth = Math.round(windowWidth * 0.78);
  const snapInterval = cardWidth + CARD_GAP;

  const scrollToIndex = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, MARKET_ADS.length - 1));
      indexRef.current = clamped;
      setActiveIndex(clamped);
      scrollRef.current?.scrollTo({ x: clamped * snapInterval, animated: true });
    },
    [snapInterval]
  );

  useEffect(() => {
    const timer = setInterval(() => {
      if (userDraggingRef.current || Date.now() < pauseUntilRef.current) return;
      const next = (indexRef.current + 1) % MARKET_ADS.length;
      scrollToIndex(next);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [scrollToIndex]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    if (snapInterval <= 0) return;
    const next = Math.round(x / snapInterval);
    const clamped = Math.max(0, Math.min(next, MARKET_ADS.length - 1));
    if (clamped !== indexRef.current) {
      indexRef.current = clamped;
      setActiveIndex(clamped);
    }
  };

  return (
    <View style={styles.section}>
      <ScrollView
        ref={scrollRef}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        scrollEventThrottle={16}
        contentContainerStyle={[styles.row, { paddingHorizontal: SIDE_PAD }]}
        onScrollBeginDrag={() => {
          userDraggingRef.current = true;
          pauseUntilRef.current = Date.now() + AUTOPLAY_MS;
        }}
        onScrollEndDrag={() => {
          userDraggingRef.current = false;
        }}
        onMomentumScrollEnd={() => {
          userDraggingRef.current = false;
        }}
        onScroll={onScroll}
      >
        {MARKET_ADS.map((ad, i) => (
          <View key={ad.id} style={[styles.cardSlot, i < MARKET_ADS.length - 1 ? { marginRight: CARD_GAP } : null]}>
            {ad.variant === "light" ? (
              <LightAdCard ad={ad} width={cardWidth} onPress={() => onAdPress?.()} />
            ) : (
              <DarkAdCard ad={ad} width={cardWidth} onPress={() => onAdPress?.()} />
            )}
          </View>
        ))}
      </ScrollView>
      <View style={styles.dotsRow}>
        {MARKET_ADS.map((ad, i) => (
          <Pressable
            key={ad.id}
            hitSlop={6}
            onPress={() => {
              pauseUntilRef.current = Date.now() + AUTOPLAY_MS;
              scrollToIndex(i);
            }}
            accessibilityLabel={`Ad ${i + 1}`}
          >
            <View style={[styles.dot, i === activeIndex ? styles.dotActive : null]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 20
  },
  row: {
    alignItems: "center"
  },
  cardSlot: {
    flexShrink: 0
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    justifyContent: "center"
  },
  cardLight: {
    backgroundColor: "#e6e6e4"
  },
  cardDark: {
    backgroundColor: APP_SURFACE,
    borderWidth: 1,
    borderColor: "rgba(201, 255, 53, 0.12)"
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35
  },
  gridRow: {
    flex: 1,
    flexDirection: "row"
  },
  gridCell: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0, 0, 0, 0.08)"
  },
  lightGlow: {
    ...StyleSheet.absoluteFillObject
  },
  cardTextWrap: {
    paddingHorizontal: 18,
    paddingVertical: 16
  },
  lightTitle: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    color: APP_BLACK
  },
  lightSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 16,
    color: "#3a3a3a"
  },
  darkTitle: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    color: APP_TEXT
  },
  darkTitleAccent: {
    color: APP_LIME
  },
  darkSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 16,
    color: APP_TEXT_MUTED
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 12
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(248, 250, 252, 0.28)"
  },
  dotActive: {
    width: 18,
    borderRadius: 3,
    backgroundColor: APP_LIME
  }
});
