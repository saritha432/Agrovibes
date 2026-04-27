import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useLanguage, type AppLanguage } from "../localization/LanguageContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { SafeAreaView } from "react-native-safe-area-context";

const SLIDES = [
  {
    title: "CROPVIBE",
    subtitle: "Your Field, Your Future",
    description: "",
    mode: "brand",
    inverted: false
  },
  {
    title: "CROPVIBE",
    subtitle: "Your Field, Your Future",
    description: "",
    mode: "pattern",
    inverted: false
  },
  {
    title: "Share Your\nFarming Journey",
    subtitle: "Post daily updates, discuss crop health, and connect with farmers across the community.",
    description: "Discover",
    mode: "feature",
    inverted: false
  },
  {
    title: "Buy & Sell With Ease",
    subtitle: "Sell your farm produce and reach buyers directly for better prices and simple deals.",
    description: "Marketplace",
    mode: "feature",
    inverted: true
  },
  {
    title: "Grow Together",
    subtitle: "Collaborate with nearby farmers, ask expert questions, and share practical advice.",
    description: "Community",
    mode: "feature",
    inverted: false
  },
  {
    title: "Learn Modern Farming",
    subtitle: "Explore expert tips, smart techniques, and short learning videos to improve productivity.",
    description: "Education",
    mode: "feature",
    inverted: true
  },
  {
    title: "Reliable Farm Delivery",
    subtitle: "Track your produce shipments from source to market through trusted transport options.",
    description: "Logistics",
    mode: "feature",
    inverted: false
  },
  {
    title: "Reliable Farm Delivery",
    subtitle: "Now Your Produce Reaches Market Securely And Quickly Without Hassle.",
    description: "Logistics",
    mode: "cta",
    inverted: true
  }
] as const;

export function InitialSetupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { language, setLanguage, t } = useLanguage();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = React.useState(0);

  const finish = () => {
    navigation.reset({ index: 0, routes: [{ name: "AuthChoice" }] });
  };

  return (
    <SafeAreaView style={styles.root}>
      <FlatList
        style={styles.list}
        data={SLIDES}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(Math.max(0, Math.min(SLIDES.length - 1, i)));
        }}
        renderItem={({ item, index: itemIndex }) => (
          <View style={[styles.page, { width, height }, item.inverted ? styles.pageInverted : null]}>
            <View style={styles.topBarWrap}>
              <View style={styles.topBar} />
            </View>
            <View style={styles.content}>
              {item.mode === "brand" ? (
                <View style={styles.brandWrap}>
                  <Text style={styles.logoWord}>CROPVIBE</Text>
                  <Text style={styles.logoSub}>{item.subtitle}</Text>
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
                  <Text style={styles.logoWord}>CROPVIBE</Text>
                  <Text style={styles.logoSub}>{item.subtitle}</Text>
                </View>
              ) : (
                <View style={styles.copyWrap}>
                  <Text style={[styles.slideTag, item.inverted ? styles.slideTagInverted : null]}>{item.description}</Text>
                  <Text style={[styles.copyText, item.inverted ? styles.copyTextInverted : null]}>{item.title}</Text>
                  <Text style={[styles.copySubText, item.inverted ? styles.copySubTextInverted : null]}>{item.subtitle}</Text>
                </View>
              )}
            </View>
            {item.mode === "cta" ? (
              <View style={styles.ctaWrap}>
                <Pressable style={styles.getStartedBtn} onPress={finish}>
                  <Text style={styles.getStartedText}>{t("getStarted")}</Text>
                </Pressable>
                <View style={styles.langRow}>
                  {(["English", "Hindi", "Telugu"] as AppLanguage[]).map((lang) => (
                    <Pressable key={lang} style={[styles.langChip, language === lang ? styles.langChipActive : null]} onPress={() => setLanguage(lang)}>
                      <Text style={[styles.langChipText, language === lang ? styles.langChipTextActive : null]}>{lang}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View style={{ height: 78 }} />
            )}
            <View style={styles.paginationRow}>
              {SLIDES.map((_, dotIndex) => (
                <View
                  key={`dot-${dotIndex}`}
                  style={[
                    styles.dot,
                    dotIndex === itemIndex ? styles.dotActive : null,
                    item.inverted ? styles.dotInverted : null,
                    item.inverted && dotIndex === itemIndex ? styles.dotActiveInverted : null
                  ]}
                />
              ))}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#11161b" },
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
  ctaWrap: { width: "100%", marginBottom: 8 },
  getStartedBtn: {
    width: "100%",
    height: 40,
    borderRadius: 7,
    backgroundColor: "#1b1f23",
    alignItems: "center",
    justifyContent: "center"
  },
  getStartedText: { color: "#b9f530", fontWeight: "900", fontSize: 14 },
  langRow: { marginTop: 10, flexDirection: "row", gap: 8, justifyContent: "center" },
  langChip: { borderWidth: 1, borderColor: "#4f6414", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  langChipActive: { backgroundColor: "#1b1f23", borderColor: "#1b1f23" },
  langChipText: { color: "#1b1f23", fontSize: 11, fontWeight: "700" },
  langChipTextActive: { color: "#b9f530" },
  paginationRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#445449" },
  dotInverted: { backgroundColor: "#8aa946" },
  dotActive: { width: 16, backgroundColor: "#b9f530" },
  dotActiveInverted: { backgroundColor: "#1b1f23" }
});

