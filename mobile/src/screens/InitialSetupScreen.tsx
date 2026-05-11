import React from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
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

export function InitialSetupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { language, setLanguage, t } = useLanguage();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = React.useState(0);
  const indexRef = React.useRef(0);
  const listRef = React.useRef<FlatList<(typeof SLIDES)[number]>>(null);

  const finish = () => {
    navigation.reset({ index: 0, routes: [{ name: "AuthChoice" }] });
  };

  const openLogin = () => {
    navigation.reset({ index: 0, routes: [{ name: "AuthChoice", params: { initialMode: "login" } }] });
  };

  const scrollToSlide = React.useCallback(
    (nextIndex: number, animated: boolean) => {
      const normalizedIndex = (nextIndex + SLIDES.length) % SLIDES.length;
      indexRef.current = normalizedIndex;
      setIndex(normalizedIndex);
      listRef.current?.scrollToOffset({ offset: normalizedIndex * width, animated });
    },
    [width]
  );

  React.useEffect(() => {
    // Keep the current slide aligned when orientation or web viewport width changes.
    listRef.current?.scrollToOffset({ offset: indexRef.current * width, animated: false });
  }, [width]);

  const atLastSlide = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.carouselShell}>
        <FlatList
          ref={listRef}
          style={styles.list}
          data={SLIDES}
          horizontal
          pagingEnabled
          snapToInterval={width}
          snapToAlignment="start"
          bounces={false}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, itemIndex) => ({
            length: width,
            offset: width * itemIndex,
            index: itemIndex
          })}
          keyExtractor={(_, i) => String(i)}
          onMomentumScrollEnd={(e) => {
            const nextIndex = Math.round(e.nativeEvent.contentOffset.x / width);
            const clampedIndex = Math.max(0, Math.min(nextIndex, SLIDES.length - 1));
            indexRef.current = clampedIndex;
            setIndex(clampedIndex);
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
      </View>
      <View style={[styles.stableFooter, atLastSlide ? styles.stableFooterWithActions : null]}>
        <View style={styles.paginationRow}>
          {SLIDES.map((_, dotIndex) => (
            <Pressable
              key={`dot-${dotIndex}`}
              onPress={() => {
                scrollToSlide(dotIndex, true);
              }}
              hitSlop={8}
            >
              <View style={[styles.dot, dotIndex === index ? styles.dotActive : null]} />
            </Pressable>
          ))}
        </View>
        {atLastSlide ? (
          <>
            <View style={styles.langRow}>
              {(["English", "Hindi", "Telugu"] as AppLanguage[]).map((lang) => (
                <Pressable key={lang} style={[styles.langChip, language === lang ? styles.langChipActive : null]} onPress={() => setLanguage(lang)}>
                  <Text style={[styles.langChipText, language === lang ? styles.langChipTextActive : null]}>{lang}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.actionStack}>
              <Pressable style={styles.getStartedBtn} onPress={finish}>
                <Text style={styles.getStartedText}>{t("getStarted")}</Text>
              </Pressable>
              <Pressable style={styles.signInBtn} onPress={openLogin}>
                <Text style={styles.signInText}>{t("login")}</Text>
              </Pressable>
            </View>
          </>
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
  pageFooterSpace: { height: 74 },
  stableFooter: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 16
  },
  stableFooterWithActions: { bottom: 18 },
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
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(184, 255, 25, 0.25)" },
  dotActive: { width: 22, backgroundColor: COLORS.lime }
});

