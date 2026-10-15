import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
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
  assignPlantHealthScan,
  deletePlantHealthScan,
  fetchPlantHealthPlants,
  fetchPlantHealthScan,
  type PlantActionPriority,
  type PlantHealthPlant,
  type PlantHealthScan
} from "../../services/api";
import { APP_DARK_BG, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED, APP_TEXT_ON_LIME } from "../../theme/appColors";
import { usePlantStrings, type PlantStringKey } from "./plantHealthStrings";
import { cachePlantScan, forgetPlantScan, getCachedPlantScan } from "./plantScanCache";
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
  ui
} from "./plantHealthUi";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "PlantHealthResult">;

const DAY_MS = 24 * 60 * 60 * 1000;

const PRIORITY_COLORS: Record<PlantActionPriority, string> = {
  urgent: "#f87171",
  soon: "#facc15",
  monitor: "#4ade80"
};

const SEVERITY_COLORS: Record<string, string> = { low: "#4ade80", medium: "#facc15", high: "#f87171" };

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((item, index) => (
        <View key={`${index}-${item}`} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={[ui.body, { flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </View>
  );
}

export function PlantHealthResultScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const scanId = route.params.scanId;
  const { token } = useAuth();
  const { s, formatDate } = usePlantStrings();

  const [scan, setScan] = useState<PlantHealthScan | null>(() => getCachedPlantScan(scanId));
  const [loading, setLoading] = useState(!scan);
  const [error, setError] = useState<string | null>(null);
  const [reminderIso, setReminderIso] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [newPlantOpen, setNewPlantOpen] = useState(false);
  const [plants, setPlants] = useState<PlantHealthPlant[] | null>(null);
  const [savingTo, setSavingTo] = useState<number | null>(null);

  const onBack = useCallback(() => {
    navigation.goBack();
    return true;
  }, [navigation]);
  useAndroidScreenBack(onBack);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchPlantHealthScan(token, scanId);
      cachePlantScan(next);
      setScan(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : s("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [s, scanId, token]);

  useEffect(() => {
    if (!scan) void load();
  }, [load, scan]);

  useEffect(() => {
    if (!scan?.plantId) {
      setReminderIso(null);
      return;
    }
    void getRescanReminder(scan.plantId).then(setReminderIso);
  }, [scan?.plantId]);

  const turnReminderOn = useCallback(
    async (target: PlantHealthScan) => {
      if (!target.plantId) return;
      const dueAt = new Date(new Date(target.createdAt).getTime() + target.result.rescanInDays * DAY_MS);
      const iso = await scheduleRescanReminder({
        plantId: target.plantId,
        title: s("reminderNotifTitle", { name: target.plantName || "" }),
        body: s("reminderNotifBody"),
        dueAt
      }).catch(() => null);
      if (!iso) {
        Alert.alert(s("reminderNoPermission"));
        return;
      }
      setReminderIso(iso);
    },
    [s]
  );

  const openSave = useCallback(async () => {
    if (!token) return;
    setSaveOpen(true);
    if (plants == null) {
      try {
        setPlants(await fetchPlantHealthPlants(token));
      } catch {
        setPlants([]);
      }
    }
  }, [plants, token]);

  const applyAssign = useCallback(
    async (target: { plantId: number } | { newPlant: { name: string; plantType?: PlantHealthPlant["plantType"]; growthStage?: string | null } }) => {
      if (!token || !scan) return;
      const result = await assignPlantHealthScan(token, scan.id, target);
      cachePlantScan(result.scan);
      setScan(result.scan);
      setSaveOpen(false);
      setNewPlantOpen(false);
      setPlants(null);
      void turnReminderOn(result.scan);
    },
    [scan, token, turnReminderOn]
  );

  const confirmDelete = useCallback(() => {
    if (!token || !scan) return;
    Alert.alert(s("deleteScanConfirm"), undefined, [
      { text: s("cancel"), style: "cancel" },
      {
        text: s("delete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deletePlantHealthScan(token, scan.id);
              forgetPlantScan(scan.id);
              navigation.goBack();
            } catch (e) {
              Alert.alert(e instanceof Error ? e.message : String(e));
            }
          })();
        }
      }
    ]);
  }, [navigation, s, scan, token]);

  if (!scan) {
    return (
      <SafeAreaView style={ui.safe} edges={["top", "left", "right"]}>
        <PlantHeader title={s("resultTitle")} onBack={onBack} />
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

  const d = scan.result;
  const status = d.healthStatus;
  const color = scoreColor(d.healthScore);
  const rescanDue = new Date(new Date(scan.createdAt).getTime() + d.rescanInDays * DAY_MS);

  return (
    <SafeAreaView style={ui.safe} edges={["top", "left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" />
      <PlantHeader
        title={s("resultTitle")}
        onBack={onBack}
        right={
          <Pressable onPress={confirmDelete} hitSlop={8} style={ui.headerBtn} accessibilityLabel={s("delete")}>
            <Ionicons name="trash-outline" size={20} color={APP_TEXT_MUTED} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {scan.imageUrls.map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={[styles.photo, scan.imageUrls.length === 1 ? styles.photoSingle : null]}
              contentFit="cover"
            />
          ))}
        </ScrollView>

        <View style={styles.summaryCard}>
          {d.isPlant ? (
            <View style={styles.summaryTop}>
              <ScoreRing score={d.healthScore} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.scoreLabel}>{s("healthScore")}</Text>
                <Text style={[styles.statusText, { color }]}>{s(`status_${status}` as PlantStringKey)}</Text>
                <Text style={ui.muted}>{s("confidence", { value: d.overallConfidence })}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.summaryTop}>
              <Ionicons name="alert-circle-outline" size={40} color="#facc15" />
              <Text style={[styles.statusText, { flex: 1 }]}>{s("notPlant")}</Text>
            </View>
          )}
          {d.isPlant && (d.plant.commonName || d.plant.scientificName) ? (
            <View style={styles.idRow}>
              <Ionicons name={plantTypeIcon(d.plant.category)} size={18} color={APP_LIME} />
              <View style={{ flex: 1 }}>
                <Text style={ui.muted}>{s("identified")}</Text>
                <Text style={styles.idName}>
                  {d.plant.commonName}
                  {d.plant.scientificName ? <Text style={styles.idSci}>{`  ${d.plant.scientificName}`}</Text> : null}
                </Text>
              </View>
              <Text style={ui.muted}>{d.plant.confidence}%</Text>
            </View>
          ) : null}
          {d.summary ? <Text style={[ui.body, { marginTop: 12 }]}>{d.summary}</Text> : null}
          {d.imageQuality === "poor" ? (
            <Text style={styles.warnText}>
              {s("imageQualityPoor")}
              {d.imageQualityNotes ? ` — ${d.imageQualityNotes}` : ""}
            </Text>
          ) : null}
        </View>

        {d.needsMorePhotos ? (
          <View style={styles.requestBox}>
            <Text style={styles.requestTitle}>{s("morePhotosTitle")}</Text>
            <Text style={ui.body}>{s("morePhotosBody")}</Text>
            {d.photoRequests.length ? <Bullets items={d.photoRequests} /> : null}
            <Pressable
              style={[ui.secondaryBtn, { marginTop: 6 }]}
              onPress={() =>
                navigation.navigate("PlantHealthScan", {
                  plantId: scan.plantId ?? undefined,
                  plantName: scan.plantName ?? undefined,
                  photoRequests: d.photoRequests
                })
              }
            >
              <Ionicons name="camera-outline" size={18} color={APP_TEXT} />
              <Text style={ui.secondaryBtnText}>{s("addPhotos")}</Text>
            </Pressable>
          </View>
        ) : null}

        {d.isPlant && d.categoryScores.length ? (
          <SectionCard title={s("breakdown")} icon="pulse-outline">
            {d.categoryScores.map((row) => (
              <View key={row.key} style={{ gap: 4 }}>
                <View style={styles.barHead}>
                  <Text style={styles.barLabel}>{s(`cat_${row.key}` as PlantStringKey)}</Text>
                  <Text style={[styles.barValue, { color: scoreColor(row.score) }]}>{row.score}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${row.score}%`, backgroundColor: scoreColor(row.score) }]} />
                </View>
                {row.note ? <Text style={ui.muted}>{row.note}</Text> : null}
              </View>
            ))}
          </SectionCard>
        ) : null}

        {d.observedSymptoms.length ? (
          <SectionCard title={s("observed")} icon="eye-outline">
            <Bullets items={d.observedSymptoms} />
          </SectionCard>
        ) : null}

        {d.issues.length ? (
          <SectionCard title={s("possibleCauses")} icon="help-buoy-outline">
            {d.issues.map((issue, index) => (
              <View key={`${index}-${issue.name}`} style={styles.issue}>
                <View style={styles.issueHead}>
                  <Text style={styles.issueName}>{issue.name}</Text>
                  <Pill
                    text={s(`likelihood_${issue.likelihood}` as PlantStringKey)}
                    color={issue.likelihood === "possible" ? APP_TEXT_MUTED : APP_LIME}
                  />
                </View>
                <View style={styles.issueMeta}>
                  <Pill text={s(`severity_${issue.severity}` as PlantStringKey)} color={SEVERITY_COLORS[issue.severity] || APP_TEXT_MUTED} />
                  <View style={[styles.barTrack, { flex: 1 }]}>
                    <View style={[styles.barFill, { width: `${issue.confidence}%`, backgroundColor: APP_LIME }]} />
                  </View>
                  <Text style={ui.muted}>{issue.confidence}%</Text>
                </View>
                {issue.evidence ? <Text style={ui.body}>{issue.evidence}</Text> : null}
                {issue.explanation ? <Text style={ui.muted}>{issue.explanation}</Text> : null}
              </View>
            ))}
          </SectionCard>
        ) : null}

        {d.actions.length ? (
          <SectionCard title={s("actionPlan")} icon="list-outline">
            {d.actions.map((action, index) => (
              <View key={`${index}-${action.title}`} style={styles.action}>
                <View style={[styles.actionNum, { backgroundColor: PRIORITY_COLORS[action.priority] }]}>
                  <Text style={styles.actionNumText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.issueHead}>
                    <Text style={[styles.issueName, { flex: 1 }]}>{action.title}</Text>
                    <Pill text={s(`priority_${action.priority}` as PlantStringKey)} color={PRIORITY_COLORS[action.priority]} />
                  </View>
                  {action.detail ? <Text style={ui.body}>{action.detail}</Text> : null}
                  {action.timeframe ? <Text style={ui.muted}>{action.timeframe}</Text> : null}
                </View>
              </View>
            ))}
          </SectionCard>
        ) : null}

        {d.isPlant ? (
          <SectionCard title={s("fertilizerTitle")} icon="flask-outline">
            {d.fertilizer.needed && d.fertilizer.categories.length ? (
              d.fertilizer.categories.map((row, index) => (
                <View key={`${index}-${row.category}`} style={styles.fert}>
                  <Text style={styles.issueName}>{row.category}</Text>
                  {row.reason ? <Text style={ui.body}>{row.reason}</Text> : null}
                  {row.howToApply ? <Text style={ui.muted}>{row.howToApply}</Text> : null}
                </View>
              ))
            ) : (
              <Text style={ui.body}>{s("fertilizerNotNeeded")}</Text>
            )}
            {d.fertilizer.caution ? <Text style={styles.warnText}>{d.fertilizer.caution}</Text> : null}
            <Text style={ui.muted}>{s("fertilizerNote")}</Text>
          </SectionCard>
        ) : null}

        {d.pestControl.ipmSteps.length || d.pestControl.organicOptions.length || d.pestControl.chemicalNote ? (
          <SectionCard title={s("pestTitle")} icon="bug-outline">
            {d.pestControl.ipmSteps.length ? <Bullets items={d.pestControl.ipmSteps} /> : null}
            {d.pestControl.organicOptions.length ? (
              <>
                <Text style={styles.subHead}>{s("organicOptions")}</Text>
                <Bullets items={d.pestControl.organicOptions} />
              </>
            ) : null}
            {d.pestControl.chemicalNote ? (
              <>
                <Text style={styles.subHead}>{s("chemicalNote")}</Text>
                <Text style={styles.warnText}>{d.pestControl.chemicalNote}</Text>
              </>
            ) : null}
          </SectionCard>
        ) : null}

        {d.prevention.length ? (
          <SectionCard title={s("prevention")} icon="shield-checkmark-outline">
            <Bullets items={d.prevention} />
          </SectionCard>
        ) : null}

        {d.needsExpert ? (
          <View style={styles.expertBox}>
            <View style={ui.cardHead}>
              <Ionicons name="medkit-outline" size={18} color="#f87171" />
              <Text style={ui.cardTitle}>{s("expertTitle")}</Text>
            </View>
            {d.expertReason ? <Text style={ui.body}>{d.expertReason}</Text> : null}
            <Text style={ui.muted}>{s("expertBody")}</Text>
          </View>
        ) : null}

        {scan.plantId ? (
          <View style={ui.card}>
            <Pressable
              style={styles.plantLink}
              onPress={() => navigation.navigate("PlantHealthPlant", { plantId: scan.plantId as number })}
            >
              <Ionicons name="leaf" size={18} color={APP_LIME} />
              <Text style={[styles.issueName, { flex: 1 }]}>{s("savedTo", { name: scan.plantName || "" })}</Text>
              <Text style={styles.link}>{s("viewPlant")}</Text>
            </Pressable>
            {isRescanReminderSupported() ? (
              <View style={styles.reminderRow}>
                <Ionicons name={reminderIso ? "notifications" : "notifications-outline"} size={18} color={APP_TEXT_MUTED} />
                <Text style={[ui.body, { flex: 1 }]}>
                  {reminderIso
                    ? s("reminderOn", { date: formatDate(reminderIso) })
                    : s("reminderOff", { days: Math.max(1, Math.ceil((rescanDue.getTime() - Date.now()) / DAY_MS)) })}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    if (reminderIso && scan.plantId) {
                      void cancelRescanReminder(scan.plantId).then(() => setReminderIso(null));
                    } else {
                      void turnReminderOn(scan);
                    }
                  }}
                >
                  <Text style={styles.link}>{reminderIso ? s("reminderTurnOff") : s("reminderTurnOn")}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : d.isPlant ? (
          <Pressable style={ui.secondaryBtn} onPress={() => void openSave()}>
            <Ionicons name="bookmark-outline" size={18} color={APP_TEXT} />
            <Text style={ui.secondaryBtnText}>{s("saveToPlants")}</Text>
          </Pressable>
        ) : null}

        <Disclaimer />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={ui.primaryBtn}
          onPress={() =>
            navigation.navigate("PlantHealthScan", {
              plantId: scan.plantId ?? undefined,
              plantName: scan.plantName ?? undefined
            })
          }
        >
          <Ionicons name="camera" size={18} color={APP_TEXT_ON_LIME} />
          <Text style={ui.primaryBtnText}>{s("scanAgain")}</Text>
        </Pressable>
      </View>

      <Modal visible={saveOpen} transparent animationType="slide" onRequestClose={() => setSaveOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSaveOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={ui.modalTitle}>{s("saveToPlants")}</Text>
            <Pressable
              style={styles.sheetRow}
              onPress={() => {
                setSaveOpen(false);
                setNewPlantOpen(true);
              }}
            >
              <View style={[styles.sheetThumb, { backgroundColor: APP_LIME }]}>
                <Ionicons name="add" size={22} color={APP_TEXT_ON_LIME} />
              </View>
              <Text style={styles.sheetRowText}>{s("newPlant")}</Text>
            </Pressable>
            {plants == null ? (
              <ActivityIndicator color={APP_LIME} style={{ marginVertical: 16 }} />
            ) : plants.length ? (
              <>
                <Text style={[ui.label, { marginTop: 6 }]}>{s("chooseExisting")}</Text>
                <ScrollView style={{ maxHeight: 320 }}>
                  {plants.map((plant) => (
                    <Pressable
                      key={plant.id}
                      style={styles.sheetRow}
                      disabled={savingTo != null}
                      onPress={() => {
                        setSavingTo(plant.id);
                        void applyAssign({ plantId: plant.id })
                          .catch((e) => Alert.alert(e instanceof Error ? e.message : String(e)))
                          .finally(() => setSavingTo(null));
                      }}
                    >
                      {plant.imageUrl ? (
                        <Image source={{ uri: plant.imageUrl }} style={styles.sheetThumb} contentFit="cover" />
                      ) : (
                        <View style={styles.sheetThumb}>
                          <Ionicons name={plantTypeIcon(plant.plantType)} size={20} color={APP_LIME} />
                        </View>
                      )}
                      <Text style={[styles.sheetRowText, { flex: 1 }]} numberOfLines={1}>
                        {plant.name}
                      </Text>
                      {savingTo === plant.id ? <ActivityIndicator color={APP_LIME} /> : <ScoreBadge score={plant.lastHealthScore} />}
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <PlantFormModal
        visible={newPlantOpen}
        title={s("newPlant")}
        initial={{ name: scan.context?.plantName || d.plant.commonName || "", growthStage: scan.context?.growthStage || null }}
        onClose={() => setNewPlantOpen(false)}
        onSubmit={(input) => applyAssign({ newPlant: input })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  link: { color: APP_LIME, fontSize: 14, fontWeight: "700" },
  photo: { width: 150, height: 150, borderRadius: 14, backgroundColor: APP_SURFACE },
  photoSingle: { width: 260, height: 200 },
  summaryCard: { backgroundColor: APP_SURFACE, borderRadius: 18, padding: 16 },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  scoreLabel: { color: APP_TEXT_MUTED, fontSize: 13, fontWeight: "700" },
  statusText: { color: APP_TEXT, fontSize: 22, fontWeight: "900" },
  idRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)"
  },
  idName: { color: APP_TEXT, fontSize: 16, fontWeight: "800" },
  idSci: { color: APP_TEXT_MUTED, fontSize: 13, fontStyle: "italic", fontWeight: "400" },
  warnText: { color: "#facc15", fontSize: 13, lineHeight: 18, marginTop: 4 },
  requestBox: { backgroundColor: "rgba(250, 204, 21, 0.1)", borderRadius: 16, padding: 14, gap: 8 },
  requestTitle: { color: "#facc15", fontSize: 16, fontWeight: "800" },
  barHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  barLabel: { color: APP_TEXT, fontSize: 14, fontWeight: "600" },
  barValue: { fontSize: 14, fontWeight: "800" },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  bulletRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: APP_LIME, marginTop: 7 },
  pill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: "800" },
  issue: { backgroundColor: APP_DARK_BG, borderRadius: 12, padding: 12, gap: 6 },
  issueHead: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  issueName: { color: APP_TEXT, fontSize: 15, fontWeight: "800", flexShrink: 1 },
  issueMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  action: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  actionNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 1 },
  actionNumText: { color: APP_DARK_BG, fontSize: 12, fontWeight: "900" },
  fert: { backgroundColor: APP_DARK_BG, borderRadius: 12, padding: 12, gap: 4 },
  subHead: { color: APP_TEXT, fontSize: 14, fontWeight: "800", marginTop: 6 },
  expertBox: { backgroundColor: "rgba(248, 113, 113, 0.1)", borderRadius: 16, padding: 14, gap: 8 },
  plantLink: { flexDirection: "row", alignItems: "center", gap: 8 },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)"
  },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: APP_DARK_BG },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: APP_SURFACE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 28
  },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  sheetRowText: { color: APP_TEXT, fontSize: 16, fontWeight: "600" },
  sheetThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: APP_DARK_BG,
    alignItems: "center",
    justifyContent: "center"
  }
});
