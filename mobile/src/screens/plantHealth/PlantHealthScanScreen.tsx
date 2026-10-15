import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthContext";
import type { RootStackParamList } from "../../navigation/rootStackTypes";
import { useAndroidScreenBack } from "../../navigation/useAndroidScreenBack";
import { createPlantHealthScan, uploadImageFile } from "../../services/api";
import { APP_DARK_BG, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED, APP_TEXT_ON_LIME } from "../../theme/appColors";
import { usePlantStrings, type PlantStringKey } from "./plantHealthStrings";
import { cachePlantScan } from "./plantScanCache";
import { scheduleRescanReminder } from "./plantRescanReminders";
import { Chip, Disclaimer, GROWTH_STAGES, PlantHeader, ui } from "./plantHealthUi";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "PlantHealthScan">;

const SLOT_KEYS: PlantStringKey[] = ["slotWhole", "slotCloseup", "slotUnderside", "slotExtra"];
const SLOT_ICONS: (keyof typeof Ionicons.glyphMap)[] = ["leaf-outline", "search-outline", "layers-outline", "add"];

type Phase = "idle" | "uploading" | "analysing";

export function PlantHealthScanScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const plantId = route.params?.plantId;
  const plantName = route.params?.plantName;
  const photoRequests = route.params?.photoRequests || [];
  const { token } = useAuth();
  const { s, language } = usePlantStrings();

  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [quickName, setQuickName] = useState("");
  const [growthStage, setGrowthStage] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState("");
  const [recentInputs, setRecentInputs] = useState("");
  const [watering, setWatering] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const busy = phase !== "idle";

  const onBack = useCallback(() => {
    if (pickerSlot != null) {
      setPickerSlot(null);
      return true;
    }
    navigation.goBack();
    return true;
  }, [navigation, pickerSlot]);
  useAndroidScreenBack(onBack);

  const fillSlots = useCallback((startSlot: number, uris: string[]) => {
    setPhotos((prev) => {
      const next = [...prev];
      const queue = [...uris];
      const first = queue.shift();
      if (first) next[startSlot] = first;
      for (let i = 0; i < next.length && queue.length; i += 1) {
        if (!next[i]) next[i] = queue.shift() || null;
      }
      return next;
    });
  }, []);

  const pickFrom = useCallback(
    async (source: "camera" | "gallery") => {
      const slot = pickerSlot ?? 0;
      setPickerSlot(null);
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(s("permissionCamera"));
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.85
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        fillSlots(slot, [result.assets[0].uri]);
        return;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(s("permissionGallery"));
        return;
      }
      const freeCount = Math.max(1, photos.filter((p, i) => !p || i === slot).length);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsMultipleSelection: freeCount > 1,
        selectionLimit: freeCount
      });
      if (result.canceled || !result.assets?.length) return;
      fillSlots(slot, result.assets.map((asset) => asset.uri).filter(Boolean));
    },
    [fillSlots, photos, pickerSlot, s]
  );

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.map((value, i) => (i === index ? null : value)));
  };

  const analyse = useCallback(async () => {
    if (!token || busy) return;
    const picked = photos
      .map((uri, index) => (uri ? { uri, label: s(SLOT_KEYS[index]) } : null))
      .filter((item): item is { uri: string; label: string } => Boolean(item));
    if (!picked.length) {
      Alert.alert(s("needPhoto"));
      return;
    }
    try {
      setPhase("uploading");
      const uploaded = await Promise.all(picked.map((item) => uploadImageFile(item.uri)));
      if (!mountedRef.current) return;
      setPhase("analysing");
      const scan = await createPlantHealthScan(token, {
        imageUrls: uploaded.map((u) => u.url),
        plantId: plantId ?? null,
        language,
        context: {
          plantName: plantId ? undefined : quickName.trim() || undefined,
          growthStage: growthStage || undefined,
          symptoms: symptoms.trim() || undefined,
          recentInputs: recentInputs.trim() || undefined,
          watering: watering.trim() || undefined,
          photoLabels: picked.map((item) => item.label)
        }
      });
      cachePlantScan(scan);
      if (scan.plantId) {
        const name = scan.plantName || plantName || "";
        const dueAt = new Date(new Date(scan.createdAt).getTime() + scan.result.rescanInDays * 24 * 60 * 60 * 1000);
        void scheduleRescanReminder({
          plantId: scan.plantId,
          title: s("reminderNotifTitle", { name }),
          body: s("reminderNotifBody"),
          dueAt
        }).catch(() => undefined);
      }
      if (!mountedRef.current) return;
      navigation.replace("PlantHealthResult", { scanId: scan.id });
    } catch (e) {
      if (!mountedRef.current) return;
      setPhase("idle");
      Alert.alert(s("scanFailed"), e instanceof Error ? e.message : String(e));
    }
  }, [
    busy,
    growthStage,
    language,
    navigation,
    photos,
    plantId,
    plantName,
    quickName,
    recentInputs,
    s,
    symptoms,
    token,
    watering
  ]);

  const photoCount = photos.filter(Boolean).length;

  return (
    <SafeAreaView style={ui.safe} edges={["top", "left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" />
      <PlantHeader title={plantName ? s("scanFor", { name: plantName }) : s("scanTitle")} onBack={onBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {photoRequests.length > 0 ? (
            <View style={styles.requestBox}>
              <Text style={styles.requestTitle}>{s("morePhotosTitle")}</Text>
              {photoRequests.map((request, index) => (
                <Text key={`${index}-${request}`} style={ui.body}>
                  • {request}
                </Text>
              ))}
            </View>
          ) : (
            <View style={ui.card}>
              <View style={ui.cardHead}>
                <Ionicons name="bulb-outline" size={18} color={APP_LIME} />
                <Text style={ui.cardTitle}>{s("tipsTitle")}</Text>
              </View>
              {(["tip1", "tip2", "tip3"] as const).map((key) => (
                <View key={key} style={styles.tipRow}>
                  <Ionicons name="checkmark-circle" size={16} color={APP_LIME} />
                  <Text style={[ui.body, { flex: 1 }]}>{s(key)}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.grid}>
            {photos.map((uri, index) => (
              <Pressable
                key={SLOT_KEYS[index]}
                style={[styles.slot, uri ? styles.slotFilled : null]}
                onPress={() => (uri ? undefined : setPickerSlot(index))}
                disabled={busy}
              >
                {uri ? (
                  <>
                    <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    <Pressable style={styles.removeBtn} onPress={() => removePhoto(index)} hitSlop={8} disabled={busy}>
                      <Ionicons name="close" size={16} color="#fff" />
                    </Pressable>
                    <View style={styles.slotLabelOverlay}>
                      <Text style={styles.slotLabelOverlayText} numberOfLines={1}>
                        {s(SLOT_KEYS[index])}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Ionicons name={SLOT_ICONS[index]} size={28} color={index === 0 ? APP_LIME : APP_TEXT_MUTED} />
                    <Text style={styles.slotLabel} numberOfLines={2}>
                      {s(SLOT_KEYS[index])}
                    </Text>
                    <Text style={styles.slotAdd}>{s("addPhoto")}</Text>
                  </>
                )}
              </Pressable>
            ))}
          </View>

          <Text style={styles.detailsTitle}>{s("detailsTitle")}</Text>
          <View style={ui.card}>
            {!plantId ? (
              <>
                <Text style={[ui.label, { marginTop: 0 }]}>{s("plantNameQuick")}</Text>
                <TextInput
                  value={quickName}
                  onChangeText={setQuickName}
                  placeholder={s("plantNameQuickPh")}
                  placeholderTextColor={APP_TEXT_MUTED}
                  style={ui.input}
                  maxLength={80}
                />
              </>
            ) : null}
            <Text style={[ui.label, plantId ? { marginTop: 0 } : null]}>{s("growthStage")}</Text>
            <View style={ui.chipRow}>
              {GROWTH_STAGES.map((stage) => (
                <Chip
                  key={stage}
                  label={s(`stage_${stage}` as PlantStringKey)}
                  active={growthStage === stage}
                  onPress={() => setGrowthStage(growthStage === stage ? null : stage)}
                />
              ))}
            </View>
            <Text style={ui.label}>{s("symptomsLabel")}</Text>
            <TextInput
              value={symptoms}
              onChangeText={setSymptoms}
              placeholder={s("symptomsPh")}
              placeholderTextColor={APP_TEXT_MUTED}
              style={[ui.input, styles.multiline]}
              multiline
              maxLength={400}
            />
            <Text style={ui.label}>{s("recentInputsLabel")}</Text>
            <TextInput
              value={recentInputs}
              onChangeText={setRecentInputs}
              placeholder={s("recentInputsPh")}
              placeholderTextColor={APP_TEXT_MUTED}
              style={ui.input}
              maxLength={200}
            />
            <Text style={ui.label}>{s("wateringLabel")}</Text>
            <TextInput
              value={watering}
              onChangeText={setWatering}
              placeholder={s("wateringPh")}
              placeholderTextColor={APP_TEXT_MUTED}
              style={ui.input}
              maxLength={120}
            />
          </View>

          <View style={{ marginTop: 16 }}>
            <Disclaimer />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[ui.primaryBtn, photoCount === 0 || busy ? ui.btnDisabled : null]}
            onPress={() => void analyse()}
            disabled={busy}
          >
            <Ionicons name="sparkles" size={18} color={APP_TEXT_ON_LIME} />
            <Text style={ui.primaryBtnText}>{s("analyse")}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={pickerSlot != null} transparent animationType="fade" onRequestClose={() => setPickerSlot(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPickerSlot(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={ui.modalTitle}>{pickerSlot != null ? s(SLOT_KEYS[pickerSlot]) : ""}</Text>
            <Pressable style={styles.sheetRow} onPress={() => void pickFrom("camera")}>
              <Ionicons name="camera-outline" size={22} color={APP_TEXT} />
              <Text style={styles.sheetRowText}>{s("camera")}</Text>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => void pickFrom("gallery")}>
              <Ionicons name="images-outline" size={22} color={APP_TEXT} />
              <Text style={styles.sheetRowText}>{s("gallery")}</Text>
            </Pressable>
            <Pressable style={[styles.sheetRow, { justifyContent: "center" }]} onPress={() => setPickerSlot(null)}>
              <Text style={[styles.sheetRowText, { color: APP_TEXT_MUTED }]}>{s("cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={busy} transparent animationType="fade" onRequestClose={() => undefined}>
        <View style={styles.busyBackdrop}>
          <View style={styles.busyCard}>
            <ActivityIndicator size="large" color={APP_LIME} />
            <Text style={styles.busyTitle}>{phase === "uploading" ? s("uploading") : s("analysing")}</Text>
            <Text style={ui.muted}>{s("analysingHint")}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 0 },
  requestBox: {
    backgroundColor: "rgba(250, 204, 21, 0.1)",
    borderRadius: 16,
    padding: 14,
    gap: 6
  },
  requestTitle: { color: "#facc15", fontSize: 15, fontWeight: "800" },
  tipRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  slot: {
    width: "48%",
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: APP_SURFACE,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    gap: 6,
    overflow: "hidden"
  },
  slotFilled: { borderStyle: "solid", borderColor: APP_LIME },
  slotLabel: { color: APP_TEXT, fontSize: 13, fontWeight: "700", textAlign: "center" },
  slotAdd: { color: APP_LIME, fontSize: 12, fontWeight: "700" },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center"
  },
  slotLabelOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(0,0,0,0.55)"
  },
  slotLabelOverlayText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  detailsTitle: { color: APP_TEXT, fontSize: 16, fontWeight: "800", marginTop: 20, marginBottom: 10 },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: APP_DARK_BG },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: APP_SURFACE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 28,
    gap: 4
  },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 4 },
  sheetRowText: { color: APP_TEXT, fontSize: 16, fontWeight: "600" },
  busyBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 32 },
  busyCard: { backgroundColor: APP_SURFACE, borderRadius: 20, padding: 24, alignItems: "center", gap: 10, width: "100%" },
  busyTitle: { color: APP_TEXT, fontSize: 17, fontWeight: "800", textAlign: "center" }
});
