import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { FlatList, Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useLanguage, type AppLanguage } from "../localization/LanguageContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { SafeAreaView } from "react-native-safe-area-context";

const SLIDES = [
  {
    titleKey: "onboardingBrandTitle",
    subtitleKey: "onboardingBrandSubtitle",
    descriptionKey: "",
    mode: "brand",
    inverted: false
  },
  {
    titleKey: "onboardingBrandTitle",
    subtitleKey: "onboardingBrandSubtitle",
    descriptionKey: "",
    mode: "pattern",
    inverted: false
  },
  {
    titleKey: "onboardingSlide3Title",
    subtitleKey: "onboardingSlide3Subtitle",
    descriptionKey: "onboardingSlide3Tag",
    mode: "feature",
    inverted: false
  },
  {
    titleKey: "onboardingSlide4Title",
    subtitleKey: "onboardingSlide4Subtitle",
    descriptionKey: "onboardingSlide4Tag",
    mode: "feature",
    inverted: true
  },
  {
    titleKey: "onboardingSlide5Title",
    subtitleKey: "onboardingSlide5Subtitle",
    descriptionKey: "onboardingSlide5Tag",
    mode: "feature",
    inverted: false
  },
  {
    titleKey: "onboardingSlide6Title",
    subtitleKey: "onboardingSlide6Subtitle",
    descriptionKey: "onboardingSlide6Tag",
    mode: "feature",
    inverted: true
  },
  {
    titleKey: "onboardingSlide7Title",
    subtitleKey: "onboardingSlide7Subtitle",
    descriptionKey: "onboardingSlide7Tag",
    mode: "feature",
    inverted: false
  },
  {
    titleKey: "onboardingSlide8Title",
    subtitleKey: "onboardingSlide8Subtitle",
    descriptionKey: "onboardingSlide8Tag",
    mode: "cta",
    inverted: true
  }
] as const;
const FIRST_WORDMARK = require("../../assets/Cropvibe1.png");
const PATTERN_IMAGE = require("../../assets/cropvibe2.png");
const COLORS = {
  dark: "#242424",
  ink: "#151711",
  lime: "#b8ff19",
  limeSoft: "#d7ff74",
  muted: "#d8ded4",
  mutedDark: "#384215"
};

/** Time each onboarding slide stays visible before auto-advancing. */
const AUTOPLAY_INTERVAL_MS = 4500;

export function InitialSetupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { language, setLanguage, t } = useLanguage();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = React.useState(0);
  const indexRef = React.useRef(0);
  const listRef = React.useRef<FlatList<(typeof SLIDES)[number]>>(null);
  /** True while user is dragging the carousel (pointer / touch). */
  const userDraggingRef = React.useRef(false);
  /** Skip adding "user cooldown" after momentum end — used for autoplay-driven scrolls. */
  const suppressUserCooldownRef = React.useRef(false);
  /** Avoid stacking autoplay ticks while a programmatic scroll is still settling. */
  const autoplayScrollInFlightRef = React.useRef(false);
  /** After manual swipe / arrow / dot, wait before auto-advancing again. */
  const pauseAutoplayUntilRef = React.useRef(0);
  const widthRef = React.useRef(width);

  widthRef.current = width;
  const currentSlideInverted = SLIDES[index]?.inverted;

  const finish = () => {
    navigation.reset({ index: 0, routes: [{ name: "AuthChoice" }] });
  };

  const openLogin = () => {
    navigation.reset({ index: 0, routes: [{ name: "AuthChoice", params: { initialMode: "login" } }] });
  };

  /**
   * Scroll to slide by index. Index + UI state are updated in `onMomentumScrollEnd` from the
   * actual offset so autoplay never fights manual swipes (especially on web).
   */
  const requestScrollToIndex = React.useCallback((rawIndex: number, animated: boolean, opts?: { autoplay?: boolean }) => {
    const w = widthRef.current;
    const normalizedIndex = opts?.autoplay
      ? (Math.round(rawIndex) + SLIDES.length) % SLIDES.length
      : Math.max(0, Math.min(Math.round(rawIndex), SLIDES.length - 1));
    if (opts?.autoplay) {
      suppressUserCooldownRef.current = true;
      autoplayScrollInFlightRef.current = true;
      setTimeout(() => {
        autoplayScrollInFlightRef.current = false;
      }, 1200);
    } else {
      suppressUserCooldownRef.current = false;
      pauseAutoplayUntilRef.current = Date.now() + AUTOPLAY_INTERVAL_MS;
    }
    listRef.current?.scrollToOffset({ offset: normalizedIndex * w, animated });
  }, []);

  React.useEffect(() => {
    // Keep the current slide aligned when orientation or web viewport width changes.
    listRef.current?.scrollToOffset({ offset: indexRef.current * width, animated: false });
  }, [width]);

  React.useEffect(() => {
    if (!isFocused) return;
    const id = setInterval(() => {
      if (userDraggingRef.current) return;
      if (Date.now() < pauseAutoplayUntilRef.current) return;
      if (autoplayScrollInFlightRef.current) return;
      if (indexRef.current >= SLIDES.length - 1) {
        // Reset to first slide without reverse animation through previous pages.
        requestScrollToIndex(0, false, { autoplay: true });
        return;
      }
      const next = indexRef.current + 1;
      requestScrollToIndex(next, true, { autoplay: true });
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isFocused, width, requestScrollToIndex]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.carouselShell} pointerEvents="box-none">
        <FlatList
          ref={listRef}
          style={styles.list}
          data={SLIDES}
          horizontal
          pagingEnabled
          snapToInterval={width}
          snapToAlignment="start"
          disableIntervalMomentum
          bounces={false}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          getItemLayout={(_, itemIndex) => ({
            length: width,
            offset: width * itemIndex,
            index: itemIndex
          })}
          keyExtractor={(_, i) => String(i)}
          onScrollBeginDrag={() => {
            userDraggingRef.current = true;
            suppressUserCooldownRef.current = false;
            pauseAutoplayUntilRef.current = Date.now() + AUTOPLAY_INTERVAL_MS;
          }}
          onScrollEndDrag={() => {
            userDraggingRef.current = false;
          }}
          onScroll={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            const w = widthRef.current;
            if (w <= 0) return;
            const nextIndex = Math.round(x / w);
            const clampedIndex = Math.max(0, Math.min(nextIndex, SLIDES.length - 1));
            if (clampedIndex !== indexRef.current) {
              indexRef.current = clampedIndex;
              setIndex(clampedIndex);
            }
          }}
          onMomentumScrollEnd={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            const nextIndex = Math.round(x / width);
            const clampedIndex = Math.max(0, Math.min(nextIndex, SLIDES.length - 1));
            indexRef.current = clampedIndex;
            setIndex(clampedIndex);
            userDraggingRef.current = false;
            autoplayScrollInFlightRef.current = false;
            if (!suppressUserCooldownRef.current) {
              pauseAutoplayUntilRef.current = Date.now() + AUTOPLAY_INTERVAL_MS;
            }
            suppressUserCooldownRef.current = false;
          }}
          renderItem={({ item }) => (
            <View style={[styles.page, { width, height }, item.inverted ? styles.pageInverted : null]}>
              <View style={styles.topBarWrap}>
                <View style={[styles.topBar, item.inverted ? styles.topBarDark : null]} />
              </View>
              <View style={styles.content}>
                {item.mode === "brand" ? (
                  <View style={styles.logoOnlyWrap}>
                    <Image source={FIRST_WORDMARK} style={styles.logoImage} resizeMode="contain" />
                  </View>
                ) : item.mode === "pattern" ? (
                  <View style={styles.heroWrap}>
                    <View style={styles.heroLogoArea}>
                      <Image source={FIRST_WORDMARK} style={styles.logoImage} resizeMode="contain" />
                    </View>
                    <Image source={PATTERN_IMAGE} style={styles.heroPatternImage} resizeMode="cover" />
                  </View>
                ) : (
                  <View style={styles.copyWrap}>
                    <Text style={[styles.slideTag, item.inverted ? styles.slideTagInverted : null]}>{t(item.descriptionKey)}</Text>
                    <Text style={[styles.copyText, item.inverted ? styles.copyTextInverted : null]}>{t(item.titleKey)}</Text>
                    <Text style={[styles.copySubText, item.inverted ? styles.copySubTextInverted : null]}>{t(item.subtitleKey)}</Text>
                  </View>
                )}
              </View>
              <View style={styles.pageFooterSpace} />
            </View>
          )}
        />
        <Pressable
          style={[styles.carouselArrow, styles.carouselArrowLeft]}
          onPress={() => requestScrollToIndex(indexRef.current - 1, true)}
          disabled={index <= 0}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Previous slide"
        >
          <View style={[styles.carouselArrowInner, index <= 0 ? styles.carouselArrowDisabled : null]}>
            <Ionicons name="chevron-back" size={Platform.OS === "web" ? 26 : 28} color={COLORS.lime} />
          </View>
        </Pressable>
        <Pressable
          style={[styles.carouselArrow, styles.carouselArrowRight]}
          onPress={() => requestScrollToIndex(indexRef.current + 1, true)}
          disabled={index >= SLIDES.length - 1}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Next slide"
        >
          <View style={[styles.carouselArrowInner, index >= SLIDES.length - 1 ? styles.carouselArrowDisabled : null]}>
            <Ionicons name="chevron-forward" size={Platform.OS === "web" ? 26 : 28} color={COLORS.lime} />
          </View>
        </Pressable>
      </View>
      <View style={styles.stableFooter}>
        <View style={styles.paginationRow}>
          {SLIDES.map((_, dotIndex) => (
            <Pressable
              key={`dot-${dotIndex}`}
              onPress={() => {
                requestScrollToIndex(dotIndex, true);
              }}
              hitSlop={8}
            >
              <View
                style={[
                  styles.dot,
                  currentSlideInverted ? styles.dotOnInverted : styles.dotOnDark,
                  dotIndex === index ? (currentSlideInverted ? styles.dotActiveOnInverted : styles.dotActiveOnDark) : null
                ]}
              />
            </Pressable>
          ))}
        </View>
        <View style={styles.langRow}>
          {(["English", "Hindi", "Telugu"] as AppLanguage[]).map((lang) => (
            <Pressable key={lang} style={[styles.langChip, language === lang ? styles.langChipActive : null]} onPress={() => setLanguage(lang)}>
              <Text style={[styles.langChipText, language === lang ? styles.langChipTextActive : null]}>{lang}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.actionStack}>
          <Pressable style={styles.getStartedBtn} onPress={finish}>
            <Text style={styles.getStartedText}>Register</Text>
          </Pressable>
          <Pressable style={styles.signInBtn} onPress={openLogin}>
            <Text style={styles.signInText}>{t("login")}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.dark },
  carouselShell: { flex: 1, position: "relative" },
  list: { flex: 1 },
  carouselArrow: {
    position: "absolute",
    top: "42%",
    zIndex: 4,
    justifyContent: "center"
  },
  carouselArrowLeft: { left: 4 },
  carouselArrowRight: { right: 4 },
  carouselArrowInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(21, 23, 17, 0.55)",
    alignItems: "center",
    justifyContent: "center"
  },
  carouselArrowDisabled: {
    opacity: 0.28
  },
  page: { backgroundColor: COLORS.dark, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, justifyContent: "space-between" },
  pageInverted: { backgroundColor: COLORS.lime },
  topBarWrap: { height: 20, justifyContent: "center", alignItems: "center" },
  topBar: { width: 86, height: 3, borderRadius: 2, backgroundColor: COLORS.lime, opacity: 0.95 },
  topBarDark: { backgroundColor: COLORS.ink },
  content: { flex: 1 },
  logoOnlyWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroWrap: { flex: 1, marginHorizontal: -18, justifyContent: "space-between" },
  heroLogoArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  logoImage: { width: "82%", height: 62 },
  heroPatternImage: { width: "100%", height: "43%" },
  logoSub: { color: COLORS.limeSoft, fontWeight: "700", textAlign: "center", fontSize: 12, letterSpacing: 0.2 },
  copyWrap: { paddingTop: 22 },
  slideTag: { color: COLORS.lime, fontSize: 20, fontWeight: "400", marginBottom: 7, letterSpacing: 0.2 },
  slideTagInverted: { color: COLORS.mutedDark },
  copyText: {
    color: COLORS.lime,
    fontWeight: "600",
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 0,
    textTransform: "capitalize"
  },
  copyTextInverted: { color: COLORS.ink },
  copySubText: { marginTop: 9, color: COLORS.muted, fontWeight: "400", lineHeight: 18, fontSize: 16 },
  copySubTextInverted: { color: COLORS.mutedDark },
  pageFooterSpace: { height: 200 },
  stableFooter: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 16
  },
  actionStack: { marginTop: 10, gap: 8 },
  signInBtn: {
    height: 36,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: COLORS.ink,
    backgroundColor: "#f7ffd9",
    alignItems: "center",
    justifyContent: "center"
  },
  signInText: { color: COLORS.ink, fontWeight: "900", fontSize: 12 },
  getStartedBtn: {
    height: 36,
    borderRadius: 3,
    backgroundColor: COLORS.ink,
    alignItems: "center",
    justifyContent: "center"
  },
  getStartedText: { color: COLORS.lime, fontWeight: "900", fontSize: 12 },
  langRow: { marginTop: 10, flexDirection: "row", gap: 8, justifyContent: "center" },
  langChip: { borderWidth: 1, borderColor: COLORS.ink, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "transparent" },
  langChipActive: { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
  langChipText: { color: COLORS.mutedDark, fontSize: 10, fontWeight: "800" },
  langChipTextActive: { color: COLORS.lime },
  paginationRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotOnDark: { backgroundColor: "rgba(184, 255, 25, 0.25)" },
  dotOnInverted: { backgroundColor: "rgba(21, 23, 17, 0.24)" },
  dotActiveOnDark: { width: 22, backgroundColor: COLORS.lime },
  dotActiveOnInverted: { width: 22, backgroundColor: COLORS.ink }
});

