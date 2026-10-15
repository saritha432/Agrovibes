import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthContext";
import type { RootStackParamList } from "../../navigation/rootStackTypes";
import { useAndroidScreenBack } from "../../navigation/useAndroidScreenBack";
import {
  createPlantHealthPlant,
  fetchPlantHealthPlants,
  fetchRecentPlantHealthScans,
  type PlantHealthPlant,
  type PlantHealthScanSummary
} from "../../services/api";
import { APP_DARK_BG, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED, APP_TEXT_ON_LIME } from "../../theme/appColors";
import { usePlantStrings, type PlantStringKey } from "./plantHealthStrings";
import {
  Disclaimer,
  PlantFormModal,
  PlantHeader,
  ScoreBadge,
  plantTypeIcon,
  ui,
  useGrowthStageLabel
} from "./plantHealthUi";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const DAY_MS = 24 * 60 * 60 * 1000;

export function PlantHealthHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { token } = useAuth();
  const { s, formatDate } = usePlantStrings();
  const stageLabel = useGrowthStageLabel();
  const [plants, setPlants] = useState<PlantHealthPlant[]>([]);
  const [quickScans, setQuickScans] = useState<PlantHealthScanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const onBack = useCallback(() => {
    navigation.goBack();
    return true;
  }, [navigation]);
  useAndroidScreenBack(onBack);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [plantRows, scanRows] = await Promise.all([
        fetchPlantHealthPlants(token),
        fetchRecentPlantHealthScans(token, { unsavedOnly: true, limit: 10 })
      ]);
      setPlants(plantRows);
      setQuickScans(scanRows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : s("loadFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [s, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const rescanLabel = (plant: PlantHealthPlant) => {
    if (!plant.nextScanDueAt) return null;
    const msLeft = new Date(plant.nextScanDueAt).getTime() - Date.now();
    if (msLeft <= 0) return { due: true, text: s("rescanDue") };
    return { due: false, text: s("rescanIn", { days: Math.max(1, Math.ceil(msLeft / DAY_MS)) }) };
  };

  return (
    <SafeAreaView style={ui.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" />
      <PlantHeader title={s("title")} onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={APP_LIME}
            colors={[APP_LIME]}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="scan" size={30} color={APP_TEXT_ON_LIME} />
          </View>
          <Text style={styles.heroTitle}>{s("subtitle")}</Text>
          <Text style={styles.heroHint}>{s("scanCtaHint")}</Text>
          <Pressable style={[ui.primaryBtn, styles.heroBtn]} onPress={() => navigation.navigate("PlantHealthScan")}>
            <Ionicons name="camera" size={20} color={APP_TEXT_ON_LIME} />
            <Text style={ui.primaryBtnText}>{s("scanCta")}</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{s("myPlants")}</Text>
          <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)} hitSlop={6}>
            <Ionicons name="add" size={18} color={APP_LIME} />
            <Text style={styles.addBtnText}>{s("addPlant")}</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={APP_LIME} style={{ marginVertical: 24 }} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={ui.muted}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retryBtn}>
              <Text style={styles.addBtnText}>{s("retry")}</Text>
            </Pressable>
          </View>
        ) : plants.length === 0 ? (
          <Text style={styles.empty}>{s("noPlants")}</Text>
        ) : (
          plants.map((plant) => {
            const rescan = rescanLabel(plant);
            const meta = [s(`type_${plant.plantType}` as PlantStringKey), stageLabel(plant.growthStage)].filter(Boolean).join(" · ");
            return (
              <Pressable
                key={plant.id}
                style={styles.plantCard}
                onPress={() => navigation.navigate("PlantHealthPlant", { plantId: plant.id })}
              >
                {plant.imageUrl ? (
                  <Image source={{ uri: plant.imageUrl }} style={styles.plantThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.plantThumb, styles.plantThumbEmpty]}>
                    <Ionicons name={plantTypeIcon(plant.plantType)} size={26} color={APP_LIME} />
                  </View>
                )}
                <View style={styles.plantBody}>
                  <Text style={styles.plantName} numberOfLines={1}>
                    {plant.name}
                  </Text>
                  <Text style={ui.muted} numberOfLines={1}>
                    {meta}
                  </Text>
                  <Text style={ui.muted} numberOfLines={1}>
                    {plant.lastScanAt ? s("lastScanned", { date: formatDate(plant.lastScanAt) }) : s("notScanned")}
                  </Text>
                  {rescan ? (
                    <View style={[styles.rescanPill, rescan.due ? styles.rescanPillDue : null]}>
                      <Ionicons name="time-outline" size={12} color={rescan.due ? APP_TEXT_ON_LIME : APP_TEXT_MUTED} />
                      <Text style={[styles.rescanText, rescan.due ? styles.rescanTextDue : null]}>{rescan.text}</Text>
                    </View>
                  ) : null}
                </View>
                <ScoreBadge score={plant.lastHealthScore} />
              </Pressable>
            );
          })
        )}

        {quickScans.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 18, marginBottom: 10 }]}>{s("recentScans")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {quickScans.map((scan) => (
                <Pressable
                  key={scan.id}
                  style={styles.scanCard}
                  onPress={() => navigation.navigate("PlantHealthResult", { scanId: scan.id })}
                >
                  {scan.imageUrl ? (
                    <Image source={{ uri: scan.imageUrl }} style={styles.scanThumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.scanThumb, styles.plantThumbEmpty]} />
                  )}
                  <View style={styles.scanScore}>
                    <ScoreBadge score={scan.healthScore} />
                  </View>
                  <Text style={styles.scanTitle} numberOfLines={1}>
                    {scan.title || "—"}
                  </Text>
                  <Text style={ui.muted} numberOfLines={1}>
                    {scan.topIssue || formatDate(scan.createdAt)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        <View style={{ marginTop: 20 }}>
          <Disclaimer />
        </View>
      </ScrollView>

      <PlantFormModal
        visible={addOpen}
        title={s("addPlant")}
        onClose={() => setAddOpen(false)}
        onSubmit={async (input) => {
          if (!token) return;
          const plant = await createPlantHealthPlant(token, input);
          setAddOpen(false);
          setPlants((prev) => [plant, ...prev]);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  hero: {
    backgroundColor: APP_SURFACE,
    borderRadius: 20,
    padding: 18,
    alignItems: "center",
    marginTop: 4
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  heroTitle: { color: APP_TEXT, fontSize: 18, fontWeight: "800", textAlign: "center" },
  heroHint: { color: APP_TEXT_MUTED, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6 },
  heroBtn: { alignSelf: "stretch", marginTop: 16 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 10 },
  sectionTitle: { color: APP_TEXT, fontSize: 18, fontWeight: "800" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  addBtnText: { color: APP_LIME, fontSize: 14, fontWeight: "700" },
  empty: { color: APP_TEXT_MUTED, fontSize: 14, lineHeight: 20, paddingVertical: 12 },
  errorBox: { alignItems: "center", gap: 8, paddingVertical: 16 },
  retryBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  plantCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: APP_SURFACE,
    borderRadius: 16,
    padding: 10,
    marginBottom: 10
  },
  plantThumb: { width: 68, height: 68, borderRadius: 12, backgroundColor: APP_DARK_BG },
  plantThumbEmpty: { alignItems: "center", justifyContent: "center" },
  plantBody: { flex: 1, gap: 2 },
  plantName: { color: APP_TEXT, fontSize: 16, fontWeight: "800" },
  rescanPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: APP_DARK_BG
  },
  rescanPillDue: { backgroundColor: APP_LIME },
  rescanText: { color: APP_TEXT_MUTED, fontSize: 11, fontWeight: "700" },
  rescanTextDue: { color: APP_TEXT_ON_LIME },
  scanCard: { width: 140, backgroundColor: APP_SURFACE, borderRadius: 14, padding: 8, gap: 2 },
  scanThumb: { width: "100%", height: 100, borderRadius: 10, backgroundColor: APP_DARK_BG, marginBottom: 6 },
  scanScore: { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 22 },
  scanTitle: { color: APP_TEXT, fontSize: 14, fontWeight: "700" }
});
