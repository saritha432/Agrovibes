import { Asset } from "expo-asset";
import { ResizeMode, Video } from "expo-av";
import React, { createElement } from "react";
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useLanguage, type AppLanguage } from "../localization/LanguageContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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

const CROPVIBE_VIDEO = require("../../assets/cropvibe-intro.gif");

type OnboardingImageKey = "media" | "marketplace" | "community" | "learn" | "logistics" | "alldone";

/** Metro may return a URL string on web, or a numeric module id on native. */
type OnboardingArtModule = number | string | { uri?: string; default?: string };

const ONBOARDING_ART: Record<OnboardingImageKey, OnboardingArtModule> = {
  media: require("../../assets/onboarding/media.svg"),
  marketplace: require("../../assets/onboarding/marketplace.svg"),
  community: require("../../assets/onboarding/community.svg"),
  learn: require("../../assets/onboarding/educators.svg"),
  logistics: require("../../assets/onboarding/logistics.svg"),
  alldone: require("../../assets/onboarding/alldone.svg")
};

function artModuleToUri(module: OnboardingArtModule): string | null {
  if (typeof module === "string" && module.length > 0) return module;
  if (typeof module === "object" && module !== null) {
    if (typeof module.uri === "string" && module.uri.length > 0) return module.uri;
    if (typeof module.default === "string" && module.default.length > 0) return module.default;
  }
  if (Platform.OS !== "web" && typeof module === "number") {
    const resolved = Image.resolveAssetSource(module);
    return resolved?.uri ?? null;
  }
  return null;
}

function OnboardingIllustration({ imageKey }: { imageKey: OnboardingImageKey }) {
  const artSource = ONBOARDING_ART[imageKey];
  const [uri, setUri] = React.useState<string | null>(() => artModuleToUri(artSource));
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);

  React.useEffect(() => {
    const direct = artModuleToUri(artSource);
    if (direct) {
      setUri(direct);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const asset = Asset.fromModule(artSource as number | string);
        await asset.downloadAsync();
        const nextUri = asset.localUri ?? asset.uri;
        if (!cancelled && nextUri) setUri(nextUri);
      } catch {
        /* leave uri null — layout placeholder stays */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [artSource]);

  const onLayout = (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setSize({ w: Math.round(width), h: Math.round(height) });
    }
  };

  if (!size || !uri) {
    return <View style={styles.featureArtSvgWrap} onLayout={onLayout} />;
  }

  if (Platform.OS === "web") {
    return (
      <View style={styles.featureArtSvgWrap} onLayout={onLayout}>
        {createElement("img", {
          src: uri,
          alt: "",
          style: {
            width: size.w,
            height: size.h,
            objectFit: "contain",
            display: "block",
            pointerEvents: "none"
          }
        })}
      </View>
    );
  }

  const { SvgUri } = require("react-native-svg") as typeof import("react-native-svg");
  return (
    <View style={styles.featureArtSvgWrap} onLayout={onLayout}>
      <SvgUri uri={uri} width={size.w} height={size.h} />
    </View>
  );
}

const COLORS = {
  dark: APP_BLACK,
  ink: APP_BLACK,
  lime: APP_LIME,
  limeSoft: APP_LIME,
  muted: "#d8ded4",
  mutedDark: "#3d3d3d"
};

function BrandSplashGif() {
  return (
    <Video
      source={CROPVIBE_VIDEO}
      style={styles.brandGif}
      resizeMode={ResizeMode.COVER}
      shouldPlay
      isLooping
      isMuted
    />
  );
}

/** Auto-advance between onboarding slides (lower ms = faster). */
const AUTOPLAY_INTERVAL_MS = 1000;

/** Matches fixed footer: 2 buttons + language row + padding (prevents art clipped under buttons). */
const ONBOARDING_FOOTER_BASE_HEIGHT = 186;

/** Auto-scroll loops feature slides only; index 0 is the brand GIF (manual swipe to view). */
const ONBOARDING_AUTOPLAY_START_INDEX = 1;

const ONBOARDING_PROGRESS_STEP_COUNT = SLIDES.length - ONBOARDING_AUTOPLAY_START_INDEX;

const LANGUAGE_OPTIONS: { value: AppLanguage; label: string; nativeLabel: string; helper: string }[] = [
  { value: "English", label: "English", nativeLabel: "English", helper: "App language" },
  { value: "Hindi", label: "Hindi", nativeLabel: "हिन्दी", helper: "ऐप की भाषा" },
  { value: "Telugu", label: "Telugu", nativeLabel: "తెలుగు", helper: "యాప్ భాష" },
  { value: "Kannada", label: "Kannada", nativeLabel: "ಕನ್ನಡ", helper: "ಅಪ್ಲಿಕೇಶನ್ ಭಾಷೆ" },
  { value: "Malayalam", label: "Malayalam", nativeLabel: "മലയാളം", helper: "ആപ്പ് ഭാഷ" },
  { value: "Tamil", label: "Tamil", nativeLabel: "தமிழ்", helper: "செயலி மொழி" },
  { value: "Marathi", label: "Marathi", nativeLabel: "मराठी", helper: "अॅप भाषा" },
  { value: "Bengali", label: "Bengali", nativeLabel: "বাংলা", helper: "অ্যাপের ভাষা" }
];

export function InitialSetupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { language, setLanguage, t } = useLanguage();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const footerReserveHeight = ONBOARDING_FOOTER_BASE_HEIGHT + insets.bottom;
  const [index, setIndex] = React.useState(0);
  const [isLanguageSheetOpen, setIsLanguageSheetOpen] = React.useState(false);
  const indexRef = React.useRef(0);
  const listRef = React.useRef<FlatList<(typeof SLIDES)[number]>>(null);
  const userDraggingRef = React.useRef(false);
  const suppressUserCooldownRef = React.useRef(false);
  const autoplayScrollInFlightRef = React.useRef(false);
  const pauseAutoplayUntilRef = React.useRef(0);
  const widthRef = React.useRef(width);

  widthRef.current = width;
  const currentSlideInverted = SLIDES[index]?.inverted ?? false;
  const isBrandSlide = index === 0;
  const selectedLanguage = LANGUAGE_OPTIONS.find((option) => option.value === language) ?? LANGUAGE_OPTIONS[0];

  const selectLanguage = React.useCallback(
    async (nextLanguage: AppLanguage) => {
      await setLanguage(nextLanguage);
      setIsLanguageSheetOpen(false);
    },
    [setLanguage]
  );

  const requestScrollToIndex = React.useCallback((rawIndex: number, animated: boolean, opts?: { autoplay?: boolean }) => {
    const w = widthRef.current;
    const clamped = Math.max(0, Math.min(Math.round(rawIndex), SLIDES.length - 1));
    const normalizedIndex =
      opts?.autoplay && clamped < ONBOARDING_AUTOPLAY_START_INDEX
        ? ONBOARDING_AUTOPLAY_START_INDEX
        : clamped;
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
        requestScrollToIndex(ONBOARDING_AUTOPLAY_START_INDEX, true, { autoplay: true });
        return;
      }
      const next = indexRef.current + 1;
      requestScrollToIndex(next, true, { autoplay: true });
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isFocused, width, requestScrollToIndex]);

  return (
    <SafeAreaView
      style={[styles.root, currentSlideInverted ? styles.rootLime : null]}
      edges={["top", "left", "right"]}
    >
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
              {item.mode !== "brand" ? (
                <View style={styles.topBarWrap}>
                  <View style={styles.progressRow}>
                    {Array.from({ length: ONBOARDING_PROGRESS_STEP_COUNT }, (_, stepIndex) => {
                      const filledSteps = slideIndex - ONBOARDING_AUTOPLAY_START_INDEX + 1;
                      const isDone = stepIndex < filledSteps;
                      return (
                        <View
                          key={`progress-${stepIndex}`}
                          style={[
                            styles.progressSegment,
                            item.inverted
                              ? isDone
                                ? styles.progressSegmentDoneInverted
                                : styles.progressSegmentPendingInverted
                              : isDone
                                ? styles.progressSegmentDoneDark
                                : styles.progressSegmentPendingDark
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
              ) : null}
              <View style={styles.content}>
                {item.mode === "brand" ? (
                  <View style={styles.brandGifWrap}>
                    <BrandSplashGif />
                  </View>
                ) : (
                  <View style={[styles.featureWrap, item.mode === "cta" ? styles.featureWrapCta : null]}>
                    <View style={[styles.copyWrap, item.mode === "cta" ? styles.copyWrapCta : null]}>
                      {item.descriptionKey ? (
                        <Text style={[styles.slideTag, item.inverted ? styles.slideTagInverted : null]}>
                          {t(item.descriptionKey)}
                        </Text>
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
                        <OnboardingIllustration imageKey={item.imageKey} />
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
              <View
                style={
                  item.mode === "brand"
                    ? styles.pageFooterSpaceBrand
                    : { height: footerReserveHeight }
                }
              />
            </View>
          )}
        />
      </View>
      {!isBrandSlide ? (
        <View
          style={[
            styles.stableFooter,
            { paddingBottom: Math.max(16, insets.bottom + 8) },
            currentSlideInverted ? styles.stableFooterLime : styles.stableFooterDark
          ]}
        >
          <View style={styles.authActionsWrap}>
            <Pressable
              style={[
                styles.getStartedBtn,
                currentSlideInverted ? styles.getStartedBtnOnLime : null
              ]}
              onPress={() => navigation.navigate("AuthChoice", { initialMode: "register" })}
            >
              <Text
                style={[
                  styles.getStartedBtnText,
                  currentSlideInverted ? styles.getStartedBtnTextOnLime : null
                ]}
              >
                {t("getStarted")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.signInBtn, currentSlideInverted ? styles.signInBtnOnLime : null]}
              onPress={() => navigation.navigate("AuthChoice", { initialMode: "login" })}
            >
              <Text
                style={[styles.signInBtnText, currentSlideInverted ? styles.signInBtnTextOnLime : null]}
              >
                {t("signIn")}
              </Text>
            </Pressable>
          </View>
          <View style={styles.langRow}>
            <Pressable
              accessibilityRole="button"
              style={[
                styles.languageSelector,
                currentSlideInverted ? styles.languageSelectorOnLime : styles.languageSelectorOnDark
              ]}
              onPress={() => setIsLanguageSheetOpen(true)}
            >
              <Text style={styles.languageGlobe}>◎</Text>
              <View style={styles.languageSelectorCopy}>
                <Text
                  style={[
                    styles.languageSelectorLabel,
                    currentSlideInverted ? styles.languageSelectorLabelOnLime : styles.languageSelectorLabelOnDark
                  ]}
                >
                  {t("selectLanguage")}
                </Text>
                <Text
                  style={[
                    styles.languageSelectorValue,
                    currentSlideInverted ? styles.languageSelectorValueOnLime : styles.languageSelectorValueOnDark
                  ]}
                >
                  {selectedLanguage.label}
                </Text>
              </View>
              <Text
                style={[
                  styles.languageChevron,
                  currentSlideInverted ? styles.languageChevronOnLime : styles.languageChevronOnDark
                ]}
              >
                ˅
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <Modal
        animationType="slide"
        transparent
        visible={isLanguageSheetOpen}
        onRequestClose={() => setIsLanguageSheetOpen(false)}
      >
        <Pressable style={styles.languageModalBackdrop} onPress={() => setIsLanguageSheetOpen(false)}>
          <Pressable style={styles.languageSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.languageSheetHandle} />
            <Text style={styles.languageSheetTitle}>{t("chooseLanguageTitle").replace(/\n/g, " ")}</Text>
            <Text style={styles.languageSheetSubtitle}>{t("chooseLanguageSub")}</Text>
            <ScrollView style={styles.languageListScroll} contentContainerStyle={styles.languageList} showsVerticalScrollIndicator={false}>
              {LANGUAGE_OPTIONS.map((option) => {
                const isActive = option.value === language;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isActive }}
                    style={[styles.languageOption, isActive ? styles.languageOptionActive : null]}
                    onPress={() => selectLanguage(option.value)}
                  >
                    <View style={styles.languageOptionCopy}>
                      <Text style={[styles.languageOptionLabel, isActive ? styles.languageOptionLabelActive : null]}>
                        {option.label}
                      </Text>
                      <Text style={[styles.languageOptionNative, isActive ? styles.languageOptionNativeActive : null]}>
                        {option.nativeLabel}
                      </Text>
                      <Text style={styles.languageOptionHelper}>{option.helper}</Text>
                    </View>
                    <View style={[styles.languageRadio, isActive ? styles.languageRadioActive : null]}>
                      {isActive ? <Text style={styles.languageRadioCheck}>✓</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  brandGifWrap: {
    flex: 1,
    backgroundColor: "#000",
    borderRadius: 0,
    overflow: "hidden"
  },
  brandGif: {
    width: "100%",
    height: "100%"
  },
  heroWrap: { flex: 1, marginHorizontal: -18, justifyContent: "flex-start" },
  heroLogoArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, minHeight: 200 },
  logoImage: { width: "82%", height: 62 },
  heroPatternWrap: { width: "100%", height: "45%", justifyContent: "flex-end" },
  heroPatternImage: { width: "100%", height: "100%" },
  featureWrap: { flex: 1, paddingTop: 44 },
  featureWrapCta: { paddingTop: 28 },
  copyWrap: { paddingTop: 12, paddingHorizontal: 2, minHeight: 130 },
  copyWrapCta: { minHeight: 0, paddingTop: 4 },
  slideTag: { color: COLORS.lime, fontSize: 18, fontWeight: "600", letterSpacing: 0.1, marginBottom: 10 },
  featureArtWrap: {
    flex: 1,
    marginTop: 36,
    marginHorizontal: -18,
    paddingTop: 16,
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: 220
  },
  featureArtWrapCta: {
    marginTop: 40,
    paddingTop: 16,
    justifyContent: "center",
    minHeight: 260
  },
  featureArtSvgWrap: {
    width: "100%",
    flex: 1,
    minHeight: 220,
    maxHeight: 308,
    alignItems: "center",
    justifyContent: "center"
  },
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
  copySubText: { marginTop: 10, color: COLORS.lime, fontWeight: "400", lineHeight: 21, fontSize: 15, maxWidth: "100%" },
  copySubTextInverted: { color: COLORS.ink, opacity: 0.82 },
  pageFooterSpaceBrand: { height: 8 },
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
  getStartedBtnOnLime: {
    backgroundColor: APP_BLACK
  },
  getStartedBtnText: { color: COLORS.lime, fontSize: 14, fontWeight: "700" },
  getStartedBtnTextOnLime: { color: COLORS.lime },
  signInBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center"
  },
  signInBtnOnLime: {
    backgroundColor: APP_BLACK,
    borderWidth: 1,
    borderColor: APP_BLACK
  },
  signInBtnText: { color: "#1b1f23", fontSize: 14, fontWeight: "700" },
  signInBtnTextOnLime: { color: COLORS.lime },
  langRow: { marginTop: 10, alignItems: "center" },
  languageSelector: {
    minWidth: 214,
    maxWidth: "100%",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  languageSelectorOnDark: {
    borderColor: "rgba(201, 255, 53, 0.65)",
    backgroundColor: "rgba(255, 255, 255, 0.08)"
  },
  languageSelectorOnLime: {
    borderColor: APP_BLACK,
    backgroundColor: "rgba(38, 38, 38, 0.06)"
  },
  languageGlobe: { color: COLORS.lime, fontSize: 17, fontWeight: "900" },
  languageSelectorCopy: { flex: 1, minWidth: 0 },
  languageSelectorLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  languageSelectorLabelOnDark: { color: "rgba(242, 244, 239, 0.7)" },
  languageSelectorLabelOnLime: { color: "rgba(21, 23, 17, 0.65)" },
  languageSelectorValue: { marginTop: 1, fontSize: 13, fontWeight: "900" },
  languageSelectorValueOnDark: { color: "#F2F4EF" },
  languageSelectorValueOnLime: { color: APP_BLACK },
  languageChevron: { fontSize: 18, fontWeight: "900" },
  languageChevronOnDark: { color: COLORS.lime },
  languageChevronOnLime: { color: APP_BLACK },
  languageModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.58)",
    justifyContent: "flex-end"
  },
  languageSheet: {
    backgroundColor: "#151711",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 26,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(201, 255, 53, 0.2)"
  },
  languageSheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: "rgba(242, 244, 239, 0.22)",
    marginBottom: 18
  },
  languageSheetTitle: { color: COLORS.lime, fontSize: 22, lineHeight: 28, fontWeight: "900" },
  languageSheetSubtitle: {
    color: "rgba(242, 244, 239, 0.72)",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    marginTop: 8
  },
  languageListScroll: { flex: 1, marginTop: 18 },
  languageList: { gap: 10, paddingBottom: 12 },
  languageOption: {
    borderWidth: 1,
    borderColor: "rgba(242, 244, 239, 0.12)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  languageOptionActive: {
    borderColor: COLORS.lime,
    backgroundColor: "rgba(201, 255, 53, 0.12)"
  },
  languageOptionCopy: { flex: 1, minWidth: 0 },
  languageOptionLabel: { color: "#F2F4EF", fontSize: 15, fontWeight: "900" },
  languageOptionLabelActive: { color: COLORS.lime },
  languageOptionNative: { color: "rgba(242, 244, 239, 0.86)", marginTop: 3, fontSize: 13, fontWeight: "800" },
  languageOptionNativeActive: { color: "#F2F4EF" },
  languageOptionHelper: { color: "rgba(242, 244, 239, 0.48)", marginTop: 4, fontSize: 11, fontWeight: "700" },
  languageRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(242, 244, 239, 0.32)",
    alignItems: "center",
    justifyContent: "center"
  },
  languageRadioActive: {
    backgroundColor: COLORS.lime,
    borderColor: COLORS.lime
  },
  languageRadioCheck: { color: APP_BLACK, fontSize: 13, fontWeight: "900" }
});
