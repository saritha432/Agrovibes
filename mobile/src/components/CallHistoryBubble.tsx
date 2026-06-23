import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatDmCallLabel, type DmCallPayload } from "../screens/messaging/dmMessageFormats";

type Props = {
  call: DmCallPayload;
  isSelf: boolean;
  t: (key: string) => string;
};

export function CallHistoryBubble({ call, isSelf, t }: Props) {
  const label = formatDmCallLabel(call, t);
  const iconName = call.mode === "video" ? "videocam" : "call";
  const missed = call.status === "missed" || call.status === "declined" || call.status === "cancelled";

  return (
    <View style={[styles.wrap, isSelf ? styles.wrapSelf : styles.wrapPeer]}>
      <View style={[styles.iconCircle, missed ? styles.iconCircleMissed : null]}>
        <Ionicons
          name={missed ? (call.mode === "video" ? "videocam-off" : "call-outline") : iconName}
          size={18}
          color={missed ? "#ff8a80" : "#C9FF35"}
          style={call.mode === "voice" && !missed ? styles.voiceIcon : undefined}
        />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
    minWidth: 168
  },
  wrapSelf: { justifyContent: "flex-end" },
  wrapPeer: { justifyContent: "flex-start" },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(201,255,53,0.14)",
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.35)"
  },
  iconCircleMissed: {
    backgroundColor: "rgba(255,107,107,0.12)",
    borderColor: "rgba(255,107,107,0.35)"
  },
  voiceIcon: { transform: [{ rotate: "-135deg" }] },
  label: { flex: 1, color: "#f8fafc", fontSize: 14, fontWeight: "700" }
});
