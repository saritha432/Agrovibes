import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { SafeAreaView } from "react-native-safe-area-context";

const SLIDES = [
  { title: "CROPVIBE", subtitle: "Your Field, Your Future", inverted: false },
  { title: "Own Onboarding\nProcess And Keep\nUsers", subtitle: "", inverted: false },
  { title: "Own Onboarding\nProcess And Keep\nUsers", subtitle: "", inverted: true },
  { title: "Own Onboarding\nProcess And Keep\nUsers", subtitle: "", inverted: false },
  { title: "Own Onboarding\nProcess And Keep\nUsers", subtitle: "", inverted: true }
] as const;

export const INITIAL_SETUP_SEEN_KEY = "agrovibes.initial-setup.seen.v1";

export function InitialSetupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = React.useState(0);

  const finish = async () => {
    await AsyncStorage.setItem(INITIAL_SETUP_SEEN_KEY, "1");
    navigation.reset({ index: 0, routes: [{ name: "AuthEmail" }] });
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
              {item.title === "CROPVIBE" ? (
                <View style={styles.brandWrap}>
                  <Text style={styles.logoWord}>CROPVIBE</Text>
                  <Text style={styles.logoSub}>{item.subtitle}</Text>
                </View>
              ) : (
                <View style={styles.copyWrap}>
                  <Text style={[styles.copyText, item.inverted ? styles.copyTextInverted : null]}>{item.title}</Text>
                </View>
              )}
            </View>
            {itemIndex === SLIDES.length - 1 ? (
              <Pressable style={styles.getStartedBtn} onPress={finish}>
                <Text style={styles.getStartedText}>Get Started</Text>
              </Pressable>
            ) : <View style={{ height: 44 }} />}
            <View style={styles.bottomProgress} />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#11161b" },
  list: { flex: 1 },
  page: { backgroundColor: "#1d2126", paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12, justifyContent: "space-between" },
  pageInverted: { backgroundColor: "#c7ff2f" },
  topBarWrap: { height: 24, justifyContent: "center", alignItems: "center" },
  topBar: { width: 86, height: 4, borderRadius: 2, backgroundColor: "#b9f530" },
  content: { flex: 1 },
  brandWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoWord: { color: "#b9f530", fontWeight: "900", fontSize: 34, letterSpacing: 1.2, textAlign: "center" },
  logoSub: { marginTop: 4, color: "#c8d0d6", fontWeight: "600", textAlign: "center", fontSize: 10 },
  copyWrap: { paddingTop: 34 },
  copyText: { color: "#b9f530", fontWeight: "900", fontSize: 29, lineHeight: 35 },
  copyTextInverted: { color: "#1b1f23" },
  getStartedBtn: { alignSelf: "center", width: "92%", height: 36, borderRadius: 6, backgroundColor: "#1b1f23", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  getStartedText: { color: "#b9f530", fontWeight: "800", fontSize: 14 },
  bottomProgress: { alignSelf: "center", width: 56, height: 3, borderRadius: 2, backgroundColor: "#b9f530" }
});

