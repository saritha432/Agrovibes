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
import { APP_BLACK, APP_LIME } from "../theme/appColors";

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
    imageKey: "logistics",
    inverted: false
  },
  {
    titleKey: "onboardingAllDoneTitle",
    subtitleKey: "onboardingAllDoneSubtitle",
    descriptionKey: "onboardingAllDoneTag",
    mode: "cta",
    imageKey: "alldone",
    inverted: true
  }
] as const;

const FIRST_WORDMARK = require("../../assets/Cropvibe1.png");
const SPLASH_VIDEO = require("../../assets/splash.mp4");

const ONBOARDING_IMAGES: Record<
  "media" | "marketplace" | "community" | "learn" | "logistics" | "alldone",
  ImageSourcePropType
> = {
  media: require("../../assets/onboarding/media.png"),
  marketplace: require("../../assets/onboarding/marketplace.png"),
  community: require("../../assets/onboarding/community.png"),
  learn: require("../../assets/onboarding/learn.png"),
  logistics: require("../../assets/onboarding/logistics.png"),
  alldone: require("../../assets/onboarding/alldone.png")
};

const ONBOARDING_ICONS: Partial<Record<"media" | "marketplace" | "community" | "learn" | "logistics" | "alldone", ImageSourcePropType>> = {
  media: require("../../assets/onboarding/media-icon (1).png"),
  marketplace: require("../../assets/onboarding/market-icon.png"),
  community: require("../../assets/onboarding/community-icon.png"),
  learn: require("../../assets/onboarding/educator-icon.png"),
  logistics: require("../../assets/onboarding/logistics-icon.png"),
  alldone: require("../../assets/onboarding/done-icon.png")
};

const COLORS = {
  dark: APP_BLACK,
  ink: APP_BLACK,
  lime: APP_LIME,
  limeSoft: APP_LIME,
  muted: "#d8ded4",
  mutedDark: "#3d3d3d"
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
  const currentSlideInverted = SLIDES[index]?.inverted ?? false;

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

  const showFooter = index >= 1;

  return (
    <SafeAreaView style={[styles.root, currentSlideInverted ? styles.rootLime : null]}>
      <View style={[styles.carouselShell, currentSlideInverted ? styles.carouselShellLime : null]} pointerEvents="box-none">
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
                <View style={styles.progressRow}>
                  {SLIDES.map((_, segIndex) => (
                    <View
                      key={`progress-${segIndex}`}
                      style={[
                        styles.progressSegment,
                        item.inverted
                          ? segIndex <= slideIndex
                            ? styles.progressSegmentDoneInverted
                            : styles.progressSegmentPendingInverted
                          : segIndex <= slideIndex
                            ? styles.progressSegmentDoneDark
                            : styles.progressSegmentPendingDark
                      ]}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.content}>
                {item.mode === "brand" ? (
                  <View style={styles.brandVideoWrap}>
                    <BrandSplashVideo playing={Boolean(isFocused && index === 0 && slideIndex === 0)} />
                  </View>
                ) : (
                  <View style={[styles.featureWrap, item.mode === "cta" ? styles.featureWrapCta : null]}>
                    <View style={[styles.copyWrap, item.mode === "cta" ? styles.copyWrapCta : null]}>
                      {item.descriptionKey ? (
                        <View style={styles.tagRow}>
                          {"imageKey" in item && item.imageKey && ONBOARDING_ICONS[item.imageKey] ? (
                            <Image source={ONBOARDING_ICONS[item.imageKey]} style={styles.sectionIcon} resizeMode="contain" />
                          ) : null}
                          <Text style={[styles.slideTag, item.inverted ? styles.slideTagInverted : null]}>
                            {t(item.descriptionKey)}
                          </Text>
                        </View>
                      ) : null}
                      <Text
                        style={[
                          styles.copyText,
                          item.inverted ? styles.copyTextInverted : null,
                          item.mode === "cta" ? styles.copyTextCta : null
                        ]}
                      >
                        {t(item.titleKey)}
                      </Text>
                      {t(item.subtitleKey) ? (
                        <Text style={[styles.copySubText, item.inverted ? styles.copySubTextInverted : null]}>
                          {t(item.subtitleKey)}
                        </Text>
                      ) : null}
                    </View>
                    {"imageKey" in item && item.imageKey ? (
                      <View style={[styles.featureArtWrap, item.mode === "cta" ? styles.featureArtWrapCta : null]}>
                        <Image
                          source={ONBOARDING_IMAGES[item.imageKey]}
                          style={[styles.featureArtImage, item.mode === "cta" ? styles.featureArtImageCta : null]}
                          resizeMode="contain"
                        />
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
              <View
                style={
                  item.mode === "brand"
                    ? styles.pageFooterSpaceBrand
                    : item.mode === "cta"
                      ? styles.pageFooterSpaceCta
                      : styles.pageFooterSpaceFeature
                }
              />
            </View>
          )}
        />
      </View>
      {showFooter ? (
        <View style={[styles.stableFooter, currentSlideInverted ? styles.stableFooterLime : styles.stableFooterDark]}>
        {index === SLIDES.length - 1 ? (
          <View style={styles.authActionsWrap}>
            <Pressable
              style={styles.getStartedBtn}
              onPress={() => navigation.navigate("AuthChoice", { initialMode: "register" })}
            >
              <Text style={styles.getStartedBtnText}>{t("getStarted")}</Text>
            </Pressable>
            <Pressable
              style={styles.signInBtn}
              onPress={() => navigation.navigate("AuthChoice", { initialMode: "login" })}
            >
              <Text style={styles.signInBtnText}>{t("signIn")}</Text>
            </Pressable>
          </View>
        ) : null}
        {index >= 1 ? (
          <View style={styles.langRow}>
            {(["English", "Hindi", "Telugu"] as AppLanguage[]).map((lang) => {
              const isActive = language === lang;
              return (
                <Pressable
                  key={lang}
                  style={[
                    styles.langChip,
                    currentSlideInverted ? styles.langChipOnLime : styles.langChipOnDark,
                    isActive ? (currentSlideInverted ? styles.langChipActiveOnLime : styles.langChipActiveOnDark) : null
                  ]}
                  onPress={() => setLanguage(lang)}
                >
                  <Text
                    style={[
                      styles.langChipText,
                      currentSlideInverted ? styles.langChipTextOnLime : styles.langChipTextOnDark,
                      isActive ? (currentSlideInverted ? styles.langChipTextActiveOnLime : styles.langChipTextActiveOnDark) : null
                    ]}
                  >
                    {lang}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.dark },
  rootLime: { backgroundColor: COLORS.lime },
  carouselShell: { flex: 1, position: "relative" },
  carouselShellLime: { backgroundColor: COLORS.lime },
  list: { flex: 1 },
  page: { backgroundColor: COLORS.dark, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, justifyContent: "space-between" },
  pageBrand: { paddingHorizontal: 0, paddingBottom: 0 },
  pageInverted: { backgroundColor: COLORS.lime },
  topBarWrap: { height: 24, justifyContent: "center", alignItems: "center", paddingHorizontal: 2 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 5, width: "100%" },
  progressSegment: { flex: 1, height: 4, borderRadius: 2 },
  progressSegmentDoneDark: { backgroundColor: COLORS.lime, opacity: 0.95 },
  progressSegmentPendingDark: { backgroundColor: "rgba(201, 255, 53, 0.22)" },
  progressSegmentDoneInverted: { backgroundColor: COLORS.ink },
  progressSegmentPendingInverted: { backgroundColor: "rgba(21, 23, 17, 0.18)" },
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
  featureWrap: { flex: 1, paddingTop: 28 },
  featureWrapCta: { paddingTop: 12 },
  copyWrap: { paddingTop: 8, paddingHorizontal: 2, minHeight: 146 },
  copyWrapCta: { minHeight: 0, paddingTop: 4 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionIcon: { width: 20, height: 20 },
  featureArtWrap: {
    flex: 1,
    marginTop: 20,
    marginHorizontal: -18,
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: 220
  },
  featureArtWrapCta: {
    marginTop: 32,
    justifyContent: "center",
    minHeight: 260
  },
  featureArtImage: {
    width: "100%",
    height: "100%",
    maxHeight: 308
  },
  featureArtImageCta: { maxHeight: 340 },
  slideTag: { color: COLORS.lime, fontSize: 18, fontWeight: "600", letterSpacing: 0.1 },
  slideTagInverted: { color: "#262626" },
  copyText: {
    color: COLORS.lime,
    fontWeight: "600",
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 0,
    textTransform: "capitalize"
  },
  copyTextInverted: { color: COLORS.ink },
  copyTextCta: { textTransform: "none", fontSize: 30, lineHeight: 38 },
  copySubText: { marginTop: 10, color: COLORS.muted, fontWeight: "400", lineHeight: 21, fontSize: 15, maxWidth: "100%" },
  copySubTextInverted: { color: COLORS.ink, opacity: 0.82 },
  pageFooterSpaceBrand: { height: 14 },
  pageFooterSpace: { height: 175 },
  pageFooterSpaceFeature: { height: 100 },
  pageFooterSpaceCta: { height: 168 },
  stableFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingBottom: 16,
    paddingTop: 10
  },
  stableFooterDark: { backgroundColor: APP_BLACK },
  stableFooterLime: { backgroundColor: COLORS.lime },
  authActionsWrap: { marginBottom: 14, gap: 9 },
  getStartedBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: "#1b1f23",
    alignItems: "center",
    justifyContent: "center"
  },
  getStartedBtnText: { color: COLORS.lime, fontSize: 14, fontWeight: "700" },
  signInBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center"
  },
  signInBtnText: { color: "#1b1f23", fontSize: 14, fontWeight: "700" },
  langRow: { marginTop: 10, flexDirection: "row", gap: 8, justifyContent: "center" },
  langChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  langChipOnDark: {
    borderColor: "rgba(201, 255, 53, 0.65)",
    backgroundColor: "rgba(255, 255, 255, 0.08)"
  },
  langChipActiveOnDark: {
    backgroundColor: COLORS.lime,
    borderColor: COLORS.lime
  },
  langChipTextOnDark: { color: "#F2F4EF", fontSize: 11, fontWeight: "800" },
  langChipTextActiveOnDark: { color: APP_BLACK },
  langChipOnLime: {
    borderColor: APP_BLACK,
    backgroundColor: "rgba(38, 38, 38, 0.06)"
  },
  langChipActiveOnLime: {
    backgroundColor: APP_BLACK,
    borderColor: APP_BLACK
  },
  langChipTextOnLime: { color: APP_BLACK, fontSize: 11, fontWeight: "800" },
  langChipTextActiveOnLime: { color: COLORS.lime },
  langChipText: { fontSize: 11, fontWeight: "800" }
});
