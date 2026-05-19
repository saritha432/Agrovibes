import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  facing?: "front" | "back";
  onPress?: () => void;
};

export function StoryCameraPreview({ facing = "front", onPress }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!permission?.granted) void requestPermission();
  }, [permission?.granted, requestPermission]);

  if (!permission?.granted) {
    return (
      <Pressable style={styles.fallback} onPress={onPress}>
        <Ionicons name="camera-outline" size={36} color="#b7ff37" />
        <Text style={styles.hint}>Tap to allow camera</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.wrap} onPress={onPress}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="picture"
        active
        onCameraReady={() => setReady(true)}
      />
      {!ready ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color="#d8ff37" />
        </View>
      ) : null}
      <View style={styles.guideFrame} pointerEvents="none">
        <View style={styles.cornerTL} />
        <View style={styles.cornerTR} />
        <View style={styles.cornerBL} />
        <View style={styles.cornerBR} />
      </View>
    </Pressable>
  );
}

const corner = {
  position: "absolute" as const,
  width: 22,
  height: 22,
  borderColor: "#d8ff37"
};

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: "hidden", backgroundColor: "#000" },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2e2e2e",
    gap: 8
  },
  hint: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  guideFrame: { ...StyleSheet.absoluteFillObject, margin: 18 },
  cornerTL: { ...corner, top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { ...corner, top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { ...corner, bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { ...corner, bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 }
});
