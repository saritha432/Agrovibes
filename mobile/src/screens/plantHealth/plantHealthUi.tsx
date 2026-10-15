import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { PlantHealthStatus, PlantInput, PlantType } from "../../services/api";
import { APP_DARK_BG, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED, APP_TEXT_ON_LIME } from "../../theme/appColors";
import { usePlantStrings, type PlantStringKey } from "./plantHealthStrings";

export const PLANT_TYPES: PlantType[] = ["crop", "vegetable", "fruit", "tree", "flower", "houseplant", "other"];
export const GROWTH_STAGES = ["seedling", "vegetative", "flowering", "fruiting", "harvest", "mature"] as const;

export function plantTypeIcon(type: string | null | undefined): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "tree":
      return "leaf";
    case "flower":
      return "flower-outline";
    case "fruit":
      return "nutrition-outline";
    case "houseplant":
      return "home-outline";
    default:
      return "leaf-outline";
  }
}

export function statusForScore(score: number): PlantHealthStatus {
  if (score >= 85) return "healthy";
  if (score >= 70) return "mild";
  if (score >= 50) return "moderate";
  if (score >= 30) return "severe";
  return "critical";
}

export function scoreColor(score: number | null | undefined) {
  const n = Number(score);
  if (!Number.isFinite(n)) return APP_TEXT_MUTED;
  if (n >= 85) return "#4ade80";
  if (n >= 70) return APP_LIME;
  if (n >= 50) return "#facc15";
  if (n >= 30) return "#fb923c";
  return "#f87171";
}

/** Localized label for a stored growth stage (falls back to the raw text the user typed). */
export function useGrowthStageLabel() {
  const { s } = usePlantStrings();
  return (stage: string | null | undefined) => {
    if (!stage) return "";
    const key = `stage_${stage}` as PlantStringKey;
    return (GROWTH_STAGES as readonly string[]).includes(stage) ? s(key) : stage;
  };
}

export function ScoreRing({ score, size = 96, stroke = 9 }: { score: number; size?: number; stroke?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = scoreColor(clamped);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[ui.ringScore, { fontSize: size * 0.3, color }]}>{clamped}</Text>
    </View>
  );
}

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  return (
    <View style={[ui.scoreBadge, { borderColor: scoreColor(score) }]}>
      <Text style={[ui.scoreBadgeText, { color: scoreColor(score) }]}>{Math.round(score)}</Text>
    </View>
  );
}

export function PlantHeader({
  title,
  onBack,
  right
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={ui.header}>
      <Pressable onPress={onBack} hitSlop={10} style={ui.headerBtn} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
      </Pressable>
      <Text style={ui.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={ui.headerRight}>{right}</View>
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[ui.chip, active ? ui.chipActive : null]}>
      <Text style={[ui.chipText, active ? ui.chipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

export function SectionCard({
  title,
  icon,
  children
}: {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={ui.card}>
      <View style={ui.cardHead}>
        {icon ? <Ionicons name={icon} size={18} color={APP_LIME} /> : null}
        <Text style={ui.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export function PlantFormModal({
  visible,
  title,
  initial,
  onClose,
  onSubmit
}: {
  visible: boolean;
  title: string;
  initial?: Partial<PlantInput>;
  onClose: () => void;
  onSubmit: (input: PlantInput) => Promise<void>;
}) {
  const { s } = usePlantStrings();
  const [name, setName] = useState("");
  const [plantType, setPlantType] = useState<PlantType>("crop");
  const [growthStage, setGrowthStage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name || "");
    setPlantType(initial?.plantType || "crop");
    setGrowthStage(initial?.growthStage || null);
    setError(null);
    setBusy(false);
  }, [initial?.growthStage, initial?.name, initial?.plantType, visible]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: trimmed, plantType, growthStage });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={ui.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={ui.modalBackdrop} onPress={onClose} />
        <View style={ui.modalCard}>
          <Text style={ui.modalTitle}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={ui.label}>{s("plantName")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={s("plantNamePh")}
              placeholderTextColor={APP_TEXT_MUTED}
              style={ui.input}
              maxLength={80}
              autoFocus
            />
            <Text style={ui.label}>{s("plantType")}</Text>
            <View style={ui.chipRow}>
              {PLANT_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={s(`type_${type}` as PlantStringKey)}
                  active={plantType === type}
                  onPress={() => setPlantType(type)}
                />
              ))}
            </View>
            <Text style={ui.label}>{s("growthStage")}</Text>
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
            {error ? <Text style={ui.error}>{error}</Text> : null}
          </ScrollView>
          <View style={ui.modalActions}>
            <Pressable style={ui.secondaryBtn} onPress={onClose}>
              <Text style={ui.secondaryBtnText}>{s("cancel")}</Text>
            </Pressable>
            <Pressable
              style={[ui.primaryBtn, { flex: 1 }, !name.trim() || busy ? ui.btnDisabled : null]}
              onPress={() => void submit()}
              disabled={!name.trim() || busy}
            >
              {busy ? <ActivityIndicator color={APP_TEXT_ON_LIME} /> : <Text style={ui.primaryBtnText}>{s("save")}</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const ui = StyleSheet.create({
  safe: { flex: 1, backgroundColor: APP_DARK_BG },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, minHeight: 48 },
  headerBtn: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, color: APP_TEXT, fontSize: 18, fontWeight: "800", marginLeft: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 40, justifyContent: "flex-end" },
  ringScore: { fontWeight: "900" },
  scoreBadge: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  scoreBadgeText: { fontSize: 14, fontWeight: "900" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: APP_DARK_BG },
  chipActive: { backgroundColor: APP_LIME },
  chipText: { color: APP_TEXT_MUTED, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: APP_TEXT_ON_LIME },
  card: { backgroundColor: APP_SURFACE, borderRadius: 16, padding: 14, gap: 10 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { color: APP_TEXT, fontSize: 16, fontWeight: "800", flex: 1 },
  body: { color: APP_TEXT, fontSize: 14, lineHeight: 20 },
  muted: { color: APP_TEXT_MUTED, fontSize: 13, lineHeight: 18 },
  label: { color: APP_TEXT_MUTED, fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 8 },
  input: {
    backgroundColor: APP_DARK_BG,
    color: APP_TEXT,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 9,
    fontSize: 15
  },
  error: { color: "#f87171", fontSize: 13, marginTop: 10 },
  primaryBtn: {
    backgroundColor: APP_LIME,
    borderRadius: 24,
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  primaryBtnText: { color: APP_TEXT_ON_LIME, fontSize: 15, fontWeight: "800" },
  secondaryBtn: {
    borderRadius: 24,
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)"
  },
  secondaryBtnText: { color: APP_TEXT, fontSize: 15, fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  modalCard: {
    backgroundColor: APP_SURFACE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 28,
    maxHeight: "88%"
  },
  modalTitle: { color: APP_TEXT, fontSize: 18, fontWeight: "800" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  disclaimer: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(250, 204, 21, 0.08)",
    borderRadius: 12,
    padding: 12,
    alignItems: "flex-start"
  },
  disclaimerText: { color: APP_TEXT_MUTED, fontSize: 12, lineHeight: 17, flex: 1 }
});

export function Disclaimer() {
  const { s } = usePlantStrings();
  return (
    <View style={ui.disclaimer}>
      <Ionicons name="information-circle-outline" size={16} color="#facc15" />
      <Text style={ui.disclaimerText}>{s("disclaimer")}</Text>
    </View>
  );
}
