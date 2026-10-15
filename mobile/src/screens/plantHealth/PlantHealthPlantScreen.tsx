import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthContext";
import type { RootStackParamList } from "../../navigation/rootStackTypes";
import { useAndroidScreenBack } from "../../navigation/useAndroidScreenBack";
import {
  deletePlantHealthPlant,
  fetchPlantHealthPlant,
  updatePlantHealthPlant,
  type PlantHealthPlant,
  type PlantHealthScanSummary
} from "../../services/api";
import { APP_DARK_BG, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED, APP_TEXT_ON_LIME } from "../../theme/appColors";
import { usePlantStrings, type PlantStringKey } from "./plantHealthStrings";
import { cancelRescanReminder, getRescanReminder, isRescanReminderSupported, scheduleRescanReminder } from "./plantRescanReminders";
import {
  Disclaimer,
  PlantFormModal,
  PlantHeader,
  ScoreBadge,
  ScoreRing,
  SectionCard,
  plantTypeIcon,
  scoreColor,
  statusForScore,
  ui,
  useGrowthStageLabel
} from "./plantHealthUi";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "PlantHealthPlant">;

const DAY_MS = 24 * 60 * 60 * 1000;
const CHART_HEIGHT = 110;

export function PlantHealthPlantScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const plantId = route.params.plantId;
  const { token } = useAuth();
  const { s, formatDate } = usePlantStrings();
  const stageLabel = useGrowthStageLabel();

  const [plant, setPlant] = useState<PlantHealthPlant | null>(null);
  const [scans, setScans] = useState<PlantHealthScanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [reminderIso, setReminderIso] = useState<string | null>(null);

  const onBack = useCallback(() => {
    navigation.goBack();
    return true;
  }, [navigation]);
  useAndroidScreenBack(onBack);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchPlantHealthPlant(token, plantId);
      setPlant(data.plant);
      setScans(data.scans);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : s("loadFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [plantId, s, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void getRescanReminder(plantId).then(setReminderIso);
    }, [load, plantId])
  );

  const chronological = useMemo(() => [...scans].reverse().slice(-12), [scans]);

  const trend = useMemo(() => {
    if (scans.length < 2) return null;
    const diff = scans[0].healthScore - scans[1].healthScore;
    if (diff >= 5) return { key: "trend_improving" as const, icon: "trending-up" as const, color: "#4ade80", diff };
    if (diff <= -5) return { key: "trend_declining" as const, icon: "trending-down" as const, color: "#f87171", diff };
    return { key: "trend_stable" as const, icon: "remove" as const, color: APP_TEXT_MUTED, diff };
  }, [scans]);

  const confirmDelete = useCallback(() => {
    if (!token) return;
    Alert.alert(s("deletePlantConfirm"), undefined, [
      { text: s("cancel"), style: "cancel" },
      {
        text: s("delete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deletePlantHealthPlant(token, plantId);
              await cancelRescanReminder(plantId);
              navigation.goBack();
            } catch (e) {
              Alert.alert(e instanceof Error ? e.message : String(e));
            }
          })();
        }
      }
    ]);
  }, [navigation, plantId, s, token]);

  const toggleReminder = useCallback(async () => {
    if (!plant) return;
    if (reminderIso) {
      await cancelRescanReminder(plant.id);
      setReminderIso(null);
      return;
    }
    const dueAt = plant.nextScanDueAt ? new Date(plant.nextScanDueAt) : new Date(Date.now() + 7 * DAY_MS);
    const iso = await scheduleRescanReminder({
      plantId: plant.id,
      title: s("reminderNotifTitle", { name: plant.name }),
      body: s("reminderNotifBody"),
      dueAt
    }).catch(() => null);
    if (!iso) {
      Alert.alert(s("reminderNoPermission"));
      return;
    }
    setReminderIso(iso);
  }, [plant, reminderIso, s]);

  if (!plant) {
    return (
      <SafeAreaView style={ui.safe} edges={["top", "left", "right"]}>
        <PlantHeader title={s("myPlants")} onBack={onBack} />
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={APP_LIME} />
          ) : (
            <>
              <Text style={ui.muted}>{error || s("loadFailed")}</Text>
              <Pressable onPress={() => void load()} style={{ padding: 10 }}>
                <Text style={styles.link}>{s("retry")}</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const meta = [s(`type_${plant.plantType}` as PlantStringKey), stageLabel(plant.growthStage), plant.species]
    .filter(Boolean)
    .join(" · ");
  const dueMs = plant.nextScanDueAt ? new Date(plant.nextScanDueAt).getTime() - Date.now() : null;

  return (
    <SafeAreaView style={ui.safe} edges={["top", "left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" />
      <PlantHeader
        title={plant.name}
        onBack={onBack}
        right={
          <>
            <Pressable onPress={() => setEditOpen(true)} hitSlop={8} style={ui.headerBtn} accessibilityLabel={s("edit")}>
              <Ionicons name="create-outline" size={21} color={APP_TEXT} />
            </Pressable>
            <Pressable onPress={confirmDelete} hitSlop={8} style={ui.headerBtn} accessibilityLabel={s("delete")}>
              <Ionicons name="trash-outline" size={20} color={APP_TEXT_MUTED} />
            </Pressable>
          </>
        }
      />
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
        <View style={styles.topCard}>
          {plant.imageUrl ? (
            <Image source={{ uri: plant.imageUrl }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, styles.coverEmpty]}>
              <Ionicons name={plantTypeIcon(plant.plantType)} size={44} color={APP_LIME} />
            </View>
          )}
          <View style={styles.topRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.name}>{plant.name}</Text>
              {meta ? <Text style={ui.muted}>{meta}</Text> : null}
              <Text style={ui.muted}>
                {plant.lastScanAt ? s("lastScanned", { date: formatDate(plant.lastScanAt) }) : s("notScanned")}
              </Text>
              {plant.lastHealthScore != null ? (
                <Text style={[styles.status, { color: scoreColor(plant.lastHealthScore) }]}>
                  {s(`status_${plant.lastHealthStatus || statusForScore(plant.lastHealthScore)}` as PlantStringKey)}
                </Text>
              ) : null}
            </View>
            {plant.lastHealthScore != null ? <ScoreRing score={plant.lastHealthScore} size={84} stroke={8} /> : null}
          </View>
          {dueMs != null ? (
            <View style={[styles.duePill, dueMs <= 0 ? styles.duePillDue : null]}>
              <Ionicons name="time-outline" size={14} color={dueMs <= 0 ? APP_TEXT_ON_LIME : APP_TEXT_MUTED} />
              <Text style={[styles.dueText, dueMs <= 0 ? { color: APP_TEXT_ON_LIME } : null]}>
                {dueMs <= 0 ? s("rescanDue") : s("rescanIn", { days: Math.max(1, Math.ceil(dueMs / DAY_MS)) })}
              </Text>
            </View>
          ) : null}
          {isRescanReminderSupported() && plant.lastScanAt ? (
            <View style={styles.reminderRow}>
              <Ionicons name={reminderIso ? "notifications" : "notifications-outline"} size={18} color={APP_TEXT_MUTED} />
              <Text style={[ui.body, { flex: 1 }]}>
                {reminderIso
                  ? s("reminderOn", { date: formatDate(reminderIso) })
                  : s("reminderOff", { days: Math.max(1, Math.ceil((dueMs ?? 7 * DAY_MS) / DAY_MS)) })}
              </Text>
              <Pressable hitSlop={8} onPress={() => void toggleReminder()}>
                <Text style={styles.link}>{reminderIso ? s("reminderTurnOff") : s("reminderTurnOn")}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {chronological.length >= 2 ? (
          <SectionCard title={s("trend")} icon="analytics-outline">
            {trend ? (
              <View style={styles.trendRow}>
                <Ionicons name={trend.icon} size={18} color={trend.color} />
                <Text style={[styles.trendText, { color: trend.color }]}>
                  {s(trend.key)} ({trend.diff > 0 ? "+" : ""}
                  {trend.diff})
                </Text>
              </View>
            ) : null}
            <View style={styles.chart}>
              {chronological.map((scan) => (
                <Pressable
                  key={scan.id}
                  style={styles.chartCol}
                  onPress={() => navigation.navigate("PlantHealthResult", { scanId: scan.id })}
                >
                  <Text style={[styles.chartValue, { color: scoreColor(scan.healthScore) }]}>{scan.healthScore}</Text>
                  <View style={styles.chartTrack}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: Math.max(4, (scan.healthScore / 100) * CHART_HEIGHT),
                          backgroundColor: scoreColor(scan.healthScore)
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.chartDate} numberOfLines={1}>
                    {formatDate(scan.createdAt)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </SectionCard>
        ) : null}

        <Text style={styles.sectionTitle}>{s("history")}</Text>
        {scans.length === 0 ? (
          <Text style={ui.muted}>{s("noScans")}</Text>
        ) : (
          scans.map((scan) => (
            <Pressable
              key={scan.id}
              style={styles.scanRow}
              onPress={() => navigation.navigate("PlantHealthResult", { scanId: scan.id })}
            >
              {scan.imageUrl ? (
                <Image source={{ uri: scan.imageUrl }} style={styles.scanThumb} contentFit="cover" />
              ) : (
                <View style={styles.scanThumb} />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.scanDate}>{formatDate(scan.createdAt)}</Text>
                <Text style={ui.muted} numberOfLines={2}>
                  {scan.topIssue || s(`status_${scan.healthStatus}` as PlantStringKey)}
                </Text>
              </View>
              <ScoreBadge score={scan.healthScore} />
              <Ionicons name="chevron-forward" size={18} color={APP_TEXT_MUTED} />
            </Pressable>
          ))
        )}

        <Disclaimer />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={ui.primaryBtn}
          onPress={() => navigation.navigate("PlantHealthScan", { plantId: plant.id, plantName: plant.name })}
        >
          <Ionicons name="camera" size={18} color={APP_TEXT_ON_LIME} />
          <Text style={ui.primaryBtnText}>{scans.length ? s("rescanNow") : s("scanCta")}</Text>
        </Pressable>
      </View>

      <PlantFormModal
        visible={editOpen}
        title={s("editPlant")}
        initial={{ name: plant.name, plantType: plant.plantType, growthStage: plant.growthStage }}
        onClose={() => setEditOpen(false)}
        onSubmit={async (input) => {
          if (!token) return;
          const updated = await updatePlantHealthPlant(token, plant.id, input);
          setPlant(updated);
          setEditOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  link: { color: APP_LIME, fontSize: 14, fontWeight: "700" },
  topCard: { backgroundColor: APP_SURFACE, borderRadius: 18, padding: 12, gap: 12 },
  cover: { width: "100%", aspectRatio: 16 / 9, borderRadius: 14, backgroundColor: APP_DARK_BG },
  coverEmpty: { alignItems: "center", justifyContent: "center" },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4 },
  name: { color: APP_TEXT, fontSize: 20, fontWeight: "900" },
  status: { fontSize: 15, fontWeight: "800" },
  duePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: APP_DARK_BG,
    marginLeft: 4
  },
  duePillDue: { backgroundColor: APP_LIME },
  dueText: { color: APP_TEXT_MUTED, fontSize: 12, fontWeight: "700" },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)"
  },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  trendText: { fontSize: 14, fontWeight: "800" },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 6, paddingTop: 4 },
  chartCol: { flex: 1, alignItems: "center", gap: 4 },
  chartValue: { fontSize: 11, fontWeight: "800" },
  chartTrack: { height: CHART_HEIGHT, width: "70%", maxWidth: 22, justifyContent: "flex-end" },
  chartBar: { width: "100%", borderRadius: 6 },
  chartDate: { color: APP_TEXT_MUTED, fontSize: 10 },
  sectionTitle: { color: APP_TEXT, fontSize: 18, fontWeight: "800", marginTop: 6 },
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: APP_SURFACE,
    borderRadius: 14,
    padding: 10
  },
  scanThumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: APP_DARK_BG },
  scanDate: { color: APP_TEXT, fontSize: 15, fontWeight: "700" },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: APP_DARK_BG }
});
