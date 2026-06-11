import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { APP_BLACK, APP_LIME, APP_TEXT } from "../../theme/appColors";
import { getActiveMarketAds, type MarketAd } from "./marketAdsConfig";

const AUTOPLAY_MS = 5000;
const CARD_GAP = 12;
const SIDE_PAD = 21;
const BANNER_W = 326;
const BANNER_H = 142;
const BANNER_RADIUS = 19.76;
const LIGHT_CARD_BG = "#EDEDED";
const DARK_CARD_BG = "#303132";

function CardGrid({ light }: { light?: boolean }) {
  return (
    <View style={[styles.gridOverlay, light ? styles.gridOverlayLight : styles.gridOverlayDark]} pointerEvents="none">
      {Array.from({ length: 5 }).map((_, row) => (
        <View key={`r-${row}`} style={styles.gridRow}>
          {Array.from({ length: 10 }).map((__, col) => (
            <View
              key={`c-${col}`}
              style={[styles.gridCell, light ? styles.gridCellLight : styles.gridCellDark]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function AdStripCopy({ ad, variant }: { ad: MarketAd; variant: "light" | "dark" }) {
  const isDark = variant === "dark";
  return (
    <View style={styles.cardInner}>
      <Text style={isDark ? styles.darkTitleLine : styles.lightTitleLine}>{ad.title}</Text>
      {ad.titleAccent ? (
        <Text style={isDark ? styles.darkTitleAccentLine : styles.lightTitleAccentLine}>{ad.titleAccent}</Text>
      ) : null}
      <Text style={isDark ? styles.darkSubtitle : styles.lightSubtitle} numberOfLines={1}>
        {ad.subtitle}
      </Text>
    </View>
  );
}

function LightStripCard({
  ad,
  width,
  height,
  onPress
}: {
  ad: MarketAd;
  width: number;
  height: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <View style={[styles.card, styles.cardLight, { width, height, borderRadius: BANNER_RADIUS }]}>
        <CardGrid light />
        <LinearGradient
          colors={["rgba(201, 255, 53, 0.32)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 0.9 }}
          style={styles.lightGlowTop}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["transparent", "rgba(201, 255, 53, 0.26)"]}
          start={{ x: 0.4, y: 0.2 }}
          end={{ x: 1, y: 1 }}
          style={styles.lightGlowBottom}
          pointerEvents="none"
        />
        <AdStripCopy ad={ad} variant="light" />
      </View>
    </Pressable>
  );
}

function DarkStripCard({
  ad,
  width,
  height,
  onPress
}: {
  ad: MarketAd;
  width: number;
  height: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <View style={[styles.card, styles.cardDark, { width, height, borderRadius: BANNER_RADIUS }]}>
        <CardGrid />
        <LinearGradient
          colors={["transparent", "rgba(74, 100, 30, 0.5)", "rgba(201, 255, 53, 0.2)"]}
          start={{ x: 0, y: 0.4 }}
          end={{ x: 1, y: 0.8 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <AdStripCopy ad={ad} variant="dark" />
      </View>
    </Pressable>
  );
}

type MarketAdsCarouselProps = {
  onAdPress?: (ad: MarketAd) => void;
  sectionStyle?: StyleProp<ViewStyle>;
};

/** Figma alternates light → dark → light by slide index. */
function stripVariantForIndex(index: number): "light" | "dark" {
  return index % 2 === 0 ? "light" : "dark";
}

export function MarketAdsCarousel({ onAdPress, sectionStyle }: MarketAdsCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const indexRef = useRef(0);
  const userDraggingRef = useRef(false);
  const pauseUntilRef = useRef(0);

  const ads = useMemo(() => getActiveMarketAds(), []);
  const cardWidth = Math.min(BANNER_W, windowWidth - SIDE_PAD * 2);
  const cardHeight = Math.round((cardWidth / BANNER_W) * BANNER_H);
  const snapInterval = cardWidth + CARD_GAP;

  useEffect(() => {
    indexRef.current = 0;
    setActiveIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [ads.length]);

  const scrollToIndex = useCallback(
    (next: number) => {
      if (ads.length === 0) return;
      const clamped = Math.max(0, Math.min(next, ads.length - 1));
      indexRef.current = clamped;
      setActiveIndex(clamped);
      scrollRef.current?.scrollTo({ x: clamped * snapInterval, animated: true });
    },
    [ads.length, snapInterval]
  );

  useEffect(() => {
    if (ads.length <= 1) return undefined;
    const timer = setInterval(() => {
      if (userDraggingRef.current || Date.now() < pauseUntilRef.current) return;
      const next = (indexRef.current + 1) % ads.length;
      scrollToIndex(next);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [ads.length, scrollToIndex]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    if (snapInterval <= 0 || ads.length === 0) return;
    const next = Math.round(x / snapInterval);
    const clamped = Math.max(0, Math.min(next, ads.length - 1));
    if (clamped !== indexRef.current) {
      indexRef.current = clamped;
      setActiveIndex(clamped);
    }
  };

  if (ads.length === 0) return null;

  return (
    <View style={[styles.section, sectionStyle]}>
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
        {ads.map((ad, i) => {
          const variant = stripVariantForIndex(i);
          return (
            <View key={ad.id} style={[styles.cardSlot, i < ads.length - 1 ? { marginRight: CARD_GAP } : null]}>
              {variant === "light" ? (
                <LightStripCard
                  ad={ad}
                  width={cardWidth}
                  height={cardHeight}
                  onPress={() => onAdPress?.(ad)}
                />
              ) : (
                <DarkStripCard
                  ad={ad}
                  width={cardWidth}
                  height={cardHeight}
                  onPress={() => onAdPress?.(ad)}
                />
              )}
            </View>
          );
        })}
      </ScrollView>
      {ads.length > 1 ? (
        <View style={styles.dotsRow}>
          {ads.map((ad, i) => (
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 22
  },
  row: {
    alignItems: "center"
  },
  cardSlot: {
    flexShrink: 0
  },
  card: {
    overflow: "hidden",
    opacity: 1
  },
  cardLight: {
    backgroundColor: LIGHT_CARD_BG
  },
  cardDark: {
    backgroundColor: DARK_CARD_BG
  },
  cardInner: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center"
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject
  },
  gridOverlayLight: {
    opacity: 0.4
  },
  gridOverlayDark: {
    opacity: 0.22
  },
  gridRow: {
    flex: 1,
    flexDirection: "row"
  },
  gridCell: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth
  },
  gridCellLight: {
    borderColor: "rgba(0, 0, 0, 0.07)"
  },
  gridCellDark: {
    borderColor: "rgba(255, 255, 255, 0.08)"
  },
  lightGlowTop: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "58%",
    height: "72%"
  },
  lightGlowBottom: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: "52%",
    height: "58%"
  },
  lightTitleLine: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    color: APP_BLACK
  },
  lightTitleAccentLine: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    color: APP_BLACK
  },
  lightSubtitle: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "500",
    color: APP_BLACK
  },
  darkTitleLine: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    color: APP_TEXT
  },
  darkTitleAccentLine: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    color: APP_LIME
  },
  darkSubtitle: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "500",
    color: APP_TEXT
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 10
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
