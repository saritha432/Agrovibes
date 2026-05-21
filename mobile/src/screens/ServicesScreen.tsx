import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppTopBar } from "../components/AppTopBar";
import { useLanguage } from "../localization/LanguageContext";
import { APP_LIME } from "../theme/appColors";

export function ServicesScreen() {
  const { t } = useLanguage();

  const cards = useMemo(
    () => [
      {
        key: "machinery",
        title: t("serviceMachineryTitle"),
        desc: t("serviceMachineryDesc"),
        icon: "construct-outline" as const
      },
      {
        key: "logistics",
        title: t("serviceLogisticsTitle"),
        desc: t("serviceLogisticsDesc"),
        icon: "car-outline" as const
      },
      {
        key: "expert",
        title: t("serviceExpertTitle"),
        desc: t("serviceExpertDesc"),
        icon: "medkit-outline" as const
      },
      {
        key: "weather",
        title: t("serviceWeatherTitle"),
        desc: t("serviceWeatherDesc"),
        icon: "partly-sunny-outline" as const
      }
    ],
    [t]
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBottom}>
      <AppTopBar />
      <View style={styles.header}>
        <Text style={styles.title}>{t("servicesTitle")}</Text>
        <Text style={styles.sub}>{t("servicesSub")}</Text>
      </View>
      {cards.map((item) => (
        <View key={item.key} style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name={item.icon} size={20} color={APP_LIME} />
          </View>
          <View style={styles.body}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDesc}>{item.desc}</Text>
            <Pressable style={styles.cta}>
              <Text style={styles.ctaText}>{t("open")}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  scrollBottom: { paddingBottom: 100 },
  header: { padding: 12 },
  title: { fontSize: 30, fontWeight: "700", color: "#121716" },
  sub: { color: "#4b5a56", marginTop: 3, fontWeight: "500" },
  card: {
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce3e1",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    gap: 10
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#e8f5ee",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  body: { flex: 1 },
  cardTitle: { color: "#1e2926", fontWeight: "700", fontSize: 18 },
  cardDesc: { marginTop: 4, color: "#5a6865", lineHeight: 20 },
  cta: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: APP_LIME,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  ctaText: { color: APP_LIME, fontWeight: "700" }
});
