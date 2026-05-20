import { Asset } from "expo-asset";
import { ResizeMode, Video, type AVPlaybackSource } from "expo-av";
import React from "react";
import {
  FlatList,
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  useWindowDimensions
} from "react-native";
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
    titleKey: "onboardingSlide3Title",
    subtitleKey: "onboardingSlide3Subtitle",
    descriptionKey: "onboardingSlide3Tag",
    mode: "feature",
    imageKey: "media",
    inverted: false
  },
  {
    titleKey: "onboardingSlide4Title",
    subtitleKey: "onboardingSlide4Subtitle",
    descriptionKey: "onboardingSlide4Tag",
    mode: "feature",
    imageKey: "marketplace",
    inverted: true
  },
  {
    titleKey: "onboardingSlide5Title",
    subtitleKey: "onboardingSlide5Subtitle",
    descriptionKey: "onboardingSlide5Tag",
    mode: "feature",
    imageKey: "community",
    inverted: false
  },
  {
    titleKey: "onboardingSlide6Title",
    subtitleKey: "onboardingSlide6Subtitle",
    descriptionKey: "onboardingSlide6Tag",
    mode: "feature",
    imageKey: "learn",
    inverted: true
  },
  {
    titleKey: "onboardingSlide7Title",
    subtitleKey: "onboardingSlide7Subtitle",
    descriptionKey: "onboardingSlide7Tag",
    mode: "feature",
    imageKey: "logistics1",
    inverted: false
  },
  {
    titleKey: "onboardingSlide8Title",
    subtitleKey: "onboardingSlide8Subtitle",
    descriptionKey: "onboardingSlide8Tag",
    mode: "cta",
    imageKey: "logistics2",
    inverted: true
  }
] as const;

const FIRST_WORDMARK = require("../../assets/Cropvibe1.png");
const SPLASH_VIDEO = require("../../assets/splash.mp4");

const ONBOARDING_IMAGES: Record<
  "media" | "marketplace" | "community" | "learn" | "logistics1" | "logistics2",
  ImageSourcePropType
> = {
  media: require("../../assets/onboarding/media.png"),
  marketplace: require("../../assets/onboarding/marketplace.png"),
  community: require("../../assets/onboarding/community.png"),
  learn: require("../../assets/onboarding/learn.png"),
  logistics1: require("../../assets/onboarding/logistics1.png"),
  logistics2: require("../../assets/onboarding/logistics2.png")
};

const COLORS = {
  dark: "#242424",
  ink: "#151711",
  lime: "#b8ff19",
  limeSoft: "#d7ff74",
  muted: "#d8ded4",
  mutedDark: "#384215"
};

/** Web: expo-av pins the video absolute-fill; relax so object-fit matches resizeMode. */
const WEB_SPLASH_VIDEO_STYLE: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({
        position: "relative",
        left: undefined,
        top: undefined,
        right: undefined,
        bottom: undefined,
        width: "100%",
        height: "100%",
        objectFit: "cover"
      } as ViewStyle)
    : undefined;

function BrandSplashVideo({ playing }: { playing: boolean }) {
  const videoRef = React.useRef<Video | null>(null);
  const [source, setSource] = React.useState<AVPlaybackSource | null>(() =>
    Platform.OS === "web" ? null : SPLASH_VIDEO
  );

  React.useEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;
    void (async () => {
      try {
        const asset = Asset.fromModule(SPLASH_VIDEO);
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri;
        if (!cancelled && uri) setSource({ uri });
      } catch {
        if (!cancelled) setSource(SPLASH_VIDEO);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const v = videoRef.current;
    if (!v || source == null) return;
    if (playing) {
      void v.playAsync().catch(() => {});
    } else {
      void v.pauseAsync().catch(() => {});
    }
  }, [playing, source]);

  if (source == null) {
    return <View style={styles.brandVideo} />;
  }

  return (
    <Video
      ref={videoRef}
      source={source}
      style={styles.brandVideo}
      resizeMode={ResizeMode.COVER}
      videoStyle={WEB_SPLASH_VIDEO_STYLE}
      isLooping
      isMuted
      shouldPlay={playing}
      useNativeControls={false}
      onError={(msg) => {
        if (__DEV__) console.warn("[BrandSplashVideo] playback error:", msg);
      }}
    />
  );
}

const AUTOPLAY_INTERVAL_MS = 4500;
const ONBOARDING_LOOP_START_INDEX = 1;

export function InitialSetupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { language, setLanguage, t } = useLanguage();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = React.useState(0);
  const indexRef = React.useRef(0);
  const listRef = React.useRef<FlatList<(typeof SLIDES)[number]>>(null);
  const userDraggingRef = React.useRef(false);
  const suppressUserCooldownRef = React.useRef(false);
  const autoplayScrollInFlightRef = React.useRef(false);
  const pauseAutoplayUntilRef = React.useRef(0);
  const widthRef = React.useRef(width);

  widthRef.current = width;
  const currentSlideInverted = SLIDES[index]?.inverted;

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
    listRef.current?.scrollToOffset({ offset: indexRef.current * width, animated: false });
  }, [width]);

  React.useEffect(() => {
    if (!isFocused) return;
    const id = setInterval(() => {
      if (userDraggingRef.current) return;
      if (Date.now() < pauseAutoplayUntilRef.current) return;
      if (autoplayScrollInFlightRef.current) return;
      if (indexRef.current >= SLIDES.length - 1) {
        requestScrollToIndex(Math.min(ONBOARDING_LOOP_START_INDEX, SLIDES.length - 1), false, { autoplay: true });
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
          renderItem={({ item, index: slideIndex }) => (
            <View
              style={[
                styles.page,
                { width, height },
                item.inverted ? styles.pageInverted : null,
                item.mode === "brand" ? styles.pageBrand : null
              ]}
            >
              <View style={styles.topBarWrap}>
                <View style={[styles.topBar, item.inverted ? styles.topBarDark : null]} />
              </View>
              <View style={styles.content}>
                {item.mode === "brand" ? (
                  <View style={styles.brandVideoWrap}>
                    <BrandSplashVideo playing={Boolean(isFocused && index === 0 && slideIndex === 0)} />
                  </View>
                ) : (
                  <View style={styles.featureWrap}>
                    <View style={styles.copyWrap}>
                      <Text style={[styles.slideTag, item.inverted ? styles.slideTagInverted : null]}>
                        {t(item.descriptionKey)}
                      </Text>
                      <Text style={[styles.copyText, item.inverted ? styles.copyTextInverted : null]}>{t(item.titleKey)}</Text>
                      <Text style={[styles.copySubText, item.inverted ? styles.copySubTextInverted : null]}>
                        {t(item.subtitleKey)}
                      </Text>
                    </View>
                    {"imageKey" in item && item.imageKey && item.mode !== "cta" ? (
                      <View style={styles.featureArtWrap}>
                        {item.imageKey === "logistics1" ? (
                          <View style={styles.logisticsComboWrap}>
                            <Image source={ONBOARDING_IMAGES.logistics1} style={styles.logisticsMapImage} resizeMode="contain" />
                            <Image source={ONBOARDING_IMAGES.logistics2} style={styles.logisticsScooterImage} resizeMode="contain" />
                          </View>
                        ) : (
                          <Image
                            source={ONBOARDING_IMAGES[item.imageKey]}
                            style={styles.featureArtImage}
                            resizeMode="contain"
                          />
                        )}
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
              <View
                style={
                  item.mode === "brand"
                    ? styles.pageFooterSpaceBrand
                    : styles.pageFooterSpaceFeature
                }
              />
            </View>
          )}
        />
      </View>
      <View style={styles.stableFooter}>
        {index === SLIDES.length - 1 ? (
          <View style={styles.authActionsWrap}>
            <Pressable
              style={styles.getStartedBtn}
              onPress={() => navigation.navigate("AuthChoice", { initialMode: "register" })}
            >
              <Text style={styles.getStartedBtnText}>Get Started</Text>
            </Pressable>
            <Pressable
              style={styles.signInBtn}
              onPress={() => navigation.navigate("AuthChoice", { initialMode: "login" })}
            >
              <Text style={styles.signInBtnText}>Sign In</Text>
            </Pressable>
          </View>
        ) : null}
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
        {index >= 2 ? (
          <View style={styles.langRow}>
            {(["English", "Hindi", "Telugu"] as AppLanguage[]).map((lang) => (
              <Pressable key={lang} style={[styles.langChip, language === lang ? styles.langChipActive : null]} onPress={() => setLanguage(lang)}>
                <Text style={[styles.langChipText, language === lang ? styles.langChipTextActive : null]}>{lang}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.dark },
  carouselShell: { flex: 1, position: "relative" },
  list: { flex: 1 },
  page: { backgroundColor: COLORS.dark, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, justifyContent: "space-between" },
  pageBrand: { paddingHorizontal: 0, paddingBottom: 0 },
  pageInverted: { backgroundColor: COLORS.lime },
  topBarWrap: { height: 20, justifyContent: "center", alignItems: "center" },
  topBar: { width: 86, height: 3, borderRadius: 2, backgroundColor: COLORS.lime, opacity: 0.95 },
  topBarDark: { backgroundColor: COLORS.ink },
  content: { flex: 1 },
  brandVideoWrap: {
    flex: 1,
    backgroundColor: "#000",
    borderRadius: 0,
    overflow: "hidden"
  },
  brandVideo: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === "web" ? { width: "100%", height: "100%" } : null)
  },
  heroWrap: { flex: 1, marginHorizontal: -18, justifyContent: "flex-start" },
  heroLogoArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, minHeight: 200 },
  logoImage: { width: "82%", height: 62 },
  heroPatternWrap: { width: "100%", height: "45%", justifyContent: "flex-end" },
  heroPatternImage: { width: "100%", height: "100%" },
  featureWrap: { flex: 1, paddingTop: 34 },
  copyWrap: { paddingTop: 8, paddingHorizontal: 2, minHeight: 146 },
  featureArtWrap: {
    flex: 1,
    marginTop: 25,
    marginHorizontal: -18,
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: 220
  },
  featureArtImage: {
    width: "100%",
    height: "100%",
    maxHeight: 308
  },
  logisticsComboWrap: {
    width: "100%",
    height: "100%",
    maxHeight: 330,
    position: "relative",
    justifyContent: "flex-end"
  },
  logisticsMapImage: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: "62%",
    height: "95%"
  },
  logisticsScooterImage: {
    position: "absolute",
    right: 4,
    bottom: 8,
    width: "58%",
    height: "48%"
  },
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
  copySubText: { marginTop: 9, color: COLORS.muted, fontWeight: "400", lineHeight: 20, fontSize: 15, maxWidth: "96%" },
  copySubTextInverted: { color: COLORS.mutedDark },
  pageFooterSpaceBrand: { height: 14 },
  pageFooterSpace: { height: 175 },
  pageFooterSpaceFeature: { height: 100 },
  stableFooter: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 16
  },
  authActionsWrap: { marginBottom: 14, gap: 9 },
  getStartedBtn: {
    height: 42,
    borderRadius: 6,
    backgroundColor: "#1b1f23",
    alignItems: "center",
    justifyContent: "center"
  },
  getStartedBtnText: { color: COLORS.lime, fontSize: 12, fontWeight: "700" },
  signInBtn: {
    height: 42,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center"
  },
  signInBtnText: { color: "#1b1f23", fontSize: 12, fontWeight: "700" },
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
