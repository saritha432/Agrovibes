import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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
const CAROUSEL_SLIDES = [SLIDES[SLIDES.length - 1], ...SLIDES, SLIDES[0]] as const;

export function InitialSetupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { language, setLanguage, t } = useLanguage();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = React.useState(0);
  const virtualIndexRef = React.useRef(1);
  const pauseUntilRef = React.useRef(0);
  const loopFixTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = React.useRef<FlatList<(typeof SLIDES)[number]>>(null);

  const MAX_VIRTUAL = SLIDES.length + 1;

  const finish = () => {
    navigation.reset({ index: 0, routes: [{ name: "AuthChoice" }] });
  };

  const openLogin = () => {
    navigation.reset({ index: 0, routes: [{ name: "AuthChoice", params: { initialMode: "login" } }] });
  };

  const pauseAutoplay = React.useCallback((ms = 5000) => {
    pauseUntilRef.current = Date.now() + ms;
  }, []);

  const scrollToVirtualIndex = React.useCallback(
    (virtualIndex: number, animated: boolean) => {
      const clamped = Math.max(0, Math.min(virtualIndex, MAX_VIRTUAL));
      const applyScroll = () => {
        listRef.current?.scrollToOffset({ offset: clamped * width, animated });
      };
      applyScroll();
      if (
        !animated &&
        typeof requestAnimationFrame !== "undefined" &&
        (clamped === 1 || clamped === SLIDES.length)
      ) {
        requestAnimationFrame(() => {
          listRef.current?.scrollToOffset({ offset: clamped * width, animated: false });
        });
      }
      virtualIndexRef.current = clamped;
      const logicalIndex = (clamped - 1 + SLIDES.length) % SLIDES.length;
      setIndex(logicalIndex);
    },
    [width, MAX_VIRTUAL]
  );

  const clearLoopFixTimer = React.useCallback(() => {
    if (loopFixTimeoutRef.current) {
      clearTimeout(loopFixTimeoutRef.current);
      loopFixTimeoutRef.current = null;
    }
  }, []);

  const scheduleLoopResetIfStillOnClone = React.useCallback(() => {
    clearLoopFixTimer();
    loopFixTimeoutRef.current = setTimeout(() => {
      loopFixTimeoutRef.current = null;
      if (virtualIndexRef.current === MAX_VIRTUAL) {
        scrollToVirtualIndex(1, false);
      }
    }, 520);
  }, [MAX_VIRTUAL, clearLoopFixTimer, scrollToVirtualIndex]);

  React.useEffect(() => {
    // Keep the list aligned to the first real slide when screen width changes.
    listRef.current?.scrollToOffset({ offset: virtualIndexRef.current * width, animated: false });
  }, [width]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() < pauseUntilRef.current) return;
      const v = virtualIndexRef.current;
      if (v >= MAX_VIRTUAL) {
        scrollToVirtualIndex(1, false);
        return;
      }
      if (v === MAX_VIRTUAL - 1) {
        scrollToVirtualIndex(MAX_VIRTUAL, true);
        scheduleLoopResetIfStillOnClone();
        return;
      }
      scrollToVirtualIndex(v + 1, true);
    }, 3200);

    return () => {
      clearInterval(timer);
      clearLoopFixTimer();
    };
  }, [MAX_VIRTUAL, clearLoopFixTimer, scheduleLoopResetIfStillOnClone, scrollToVirtualIndex]);

  const atFirstSlide = index === 0;
  const atLastSlide = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.carouselShell}>
        <FlatList
          ref={listRef}
          style={styles.list}
          data={CAROUSEL_SLIDES}
          horizontal
          pagingEnabled
          bounces={false}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={1}
          getItemLayout={(_, itemIndex) => ({
            length: width,
            offset: width * itemIndex,
            index: itemIndex
          })}
          keyExtractor={(_, i) => String(i)}
          onScrollBeginDrag={() => {
            clearLoopFixTimer();
            pauseAutoplay();
          }}
          onMomentumScrollEnd={(e) => {
            const virtualIndex = Math.round(e.nativeEvent.contentOffset.x / width);
            if (virtualIndex === 0) {
              clearLoopFixTimer();
              // Moved left from first real slide into clone of last slide.
              scrollToVirtualIndex(SLIDES.length, false);
              return;
            }
            if (virtualIndex === MAX_VIRTUAL) {
              clearLoopFixTimer();
              // Moved right from last real slide into clone of first slide.
              scrollToVirtualIndex(1, false);
              return;
            }
            virtualIndexRef.current = virtualIndex;
            setIndex(virtualIndex - 1);
          }}
          renderItem={({ item }) => (
            <View style={[styles.page, { width, height }, item.inverted ? styles.pageInverted : null]}>
              <View style={styles.topBarWrap}>
                <View style={styles.topBar} />
              </View>
              <View style={styles.content}>
                {item.mode === "brand" ? (
                  <View style={styles.brandWrap}>
                    <Text style={styles.logoWord}>{t(item.titleKey)}</Text>
                    <Text style={styles.logoSub}>{t(item.subtitleKey)}</Text>
                  </View>
                ) : item.mode === "pattern" ? (
                  <View style={styles.patternScreenWrap}>
                    <View style={styles.patternCard}>
                      <View style={styles.patternRow}>
                        <View style={[styles.tile, styles.tileDark]} />
                        <View style={[styles.tile, styles.tileLime]} />
                        <View style={[styles.tile, styles.tileDark]} />
                      </View>
                      <View style={styles.patternRow}>
                        <View style={[styles.tile, styles.tileLime]} />
                        <View style={[styles.tile, styles.tileDark]} />
                        <View style={[styles.tile, styles.tileLime]} />
                      </View>
                      <View style={styles.patternRow}>
                        <View style={[styles.tile, styles.tileDark]} />
                        <View style={[styles.tile, styles.tileLime]} />
                        <View style={[styles.tile, styles.tileDark]} />
                      </View>
                    </View>
                    <Text style={styles.logoWord}>{t(item.titleKey)}</Text>
                    <Text style={styles.logoSub}>{t(item.subtitleKey)}</Text>
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
          style={styles.arrowHitLeft}
          disabled={atFirstSlide}
          onPress={() => {
            if (atFirstSlide) return;
            pauseAutoplay(3500);
            scrollToVirtualIndex(virtualIndexRef.current - 1, true);
          }}
          hitSlop={4}
        >
          <View style={[styles.arrowBtn, atFirstSlide ? styles.arrowBtnDisabled : null]}>
            <Text style={[styles.arrowText, atFirstSlide ? styles.arrowTextDisabled : null]}>‹</Text>
          </View>
        </Pressable>
        <Pressable
          style={styles.arrowHitRight}
          disabled={atLastSlide}
          onPress={() => {
            if (atLastSlide) return;
            pauseAutoplay(3500);
            scrollToVirtualIndex(virtualIndexRef.current + 1, true);
          }}
          hitSlop={4}
        >
          <View style={[styles.arrowBtn, atLastSlide ? styles.arrowBtnDisabled : null]}>
            <Text style={[styles.arrowText, atLastSlide ? styles.arrowTextDisabled : null]}>›</Text>
          </View>
        </Pressable>
      </View>
      <View style={styles.stableFooter}>
        <View style={styles.paginationRow}>
          {SLIDES.map((_, dotIndex) => (
            <Pressable
              key={`dot-${dotIndex}`}
              onPress={() => {
                pauseAutoplay(3500);
                scrollToVirtualIndex(dotIndex + 1, true);
              }}
              hitSlop={8}
            >
              <View style={[styles.dot, dotIndex === index ? styles.dotActive : null]} />
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
        <View style={styles.actionRow}>
          <Pressable style={styles.signInBtn} onPress={openLogin}>
            <Text style={styles.signInText}>{t("login")}</Text>
          </Pressable>
          <Pressable style={styles.getStartedBtn} onPress={finish}>
            <Text style={styles.getStartedText}>{t("getStarted")}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#11161b" },
  carouselShell: { flex: 1, position: "relative" },
  list: { flex: 1 },
  page: { backgroundColor: "#1d2126", paddingHorizontal: 22, paddingTop: 8, paddingBottom: 14, justifyContent: "space-between" },
  pageInverted: { backgroundColor: "#c7ff2f" },
  topBarWrap: { height: 24, justifyContent: "center", alignItems: "center" },
  topBar: { width: 86, height: 4, borderRadius: 2, backgroundColor: "#b9f530", opacity: 0.85 },
  content: { flex: 1 },
  brandWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  patternScreenWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  patternCard: {
    width: 96,
    height: 96,
    borderRadius: 18,
    padding: 8,
    backgroundColor: "#21262b",
    borderWidth: 1,
    borderColor: "#313841"
  },
  patternRow: { flex: 1, flexDirection: "row", gap: 6, marginBottom: 6 },
  tile: { flex: 1, borderRadius: 9 },
  tileDark: { backgroundColor: "#171c20" },
  tileLime: { backgroundColor: "#b9f530" },
  logoWord: { color: "#b9f530", fontWeight: "900", fontSize: 34, letterSpacing: 1.2, textAlign: "center", marginBottom: 4 },
  logoSub: { color: "#c8d0d6", fontWeight: "600", textAlign: "center", fontSize: 10 },
  copyWrap: { paddingTop: 20 },
  slideTag: { color: "#8bc76f", fontSize: 12, fontWeight: "700", marginBottom: 8 },
  slideTagInverted: { color: "#476112" },
  copyText: { color: "#b9f530", fontWeight: "900", fontSize: 31, lineHeight: 36, letterSpacing: -0.2 },
  copyTextInverted: { color: "#1b1f23" },
  copySubText: { marginTop: 10, color: "#bdc7c4", fontWeight: "600", lineHeight: 20, fontSize: 13 },
  copySubTextInverted: { color: "#2f3d16" },
  pageFooterSpace: { height: 132 },
  stableFooter: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14
  },
  actionRow: { marginTop: 10, flexDirection: "row", gap: 8 },
  signInBtn: {
    flex: 1,
    height: 40,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#4f6414",
    backgroundColor: "#1b1f23",
    alignItems: "center",
    justifyContent: "center"
  },
  signInText: { color: "#d4e8a2", fontWeight: "800", fontSize: 13 },
  getStartedBtn: {
    flex: 1,
    height: 40,
    borderRadius: 7,
    backgroundColor: "#1b1f23",
    alignItems: "center",
    justifyContent: "center"
  },
  getStartedText: { color: "#b9f530", fontWeight: "900", fontSize: 14 },
  langRow: { marginTop: 10, flexDirection: "row", gap: 8, justifyContent: "center" },
  langChip: { borderWidth: 1, borderColor: "#4f6414", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#1b1f23" },
  langChipActive: { backgroundColor: "#1b1f23", borderColor: "#1b1f23" },
  langChipText: { color: "#d4e8a2", fontSize: 11, fontWeight: "700" },
  langChipTextActive: { color: "#b9f530" },
  arrowHitLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 170,
    width: 48,
    justifyContent: "center",
    paddingLeft: 4,
    zIndex: 2
  },
  arrowHitRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 170,
    width: 48,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 4,
    zIndex: 2
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#4f6414",
    backgroundColor: "rgba(27, 31, 35, 0.92)",
    alignItems: "center",
    justifyContent: "center"
  },
  arrowBtnDisabled: { opacity: 0.35, borderColor: "#3a424c" },
  arrowText: { color: "#b9f530", fontSize: 18, fontWeight: "900", lineHeight: 19 },
  arrowTextDisabled: { color: "#6b7a82" },
  paginationRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#445449" },
  dotActive: { width: 16, backgroundColor: "#b9f530" }
});

