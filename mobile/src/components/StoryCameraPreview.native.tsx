import { CameraView, useCameraPermissions } from "expo-camera";
import React, { forwardRef, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  facing?: "front" | "back";
  active?: boolean;
  mode?: "picture" | "video";
  onPress?: () => void;
};

export const StoryCameraPreview = forwardRef<CameraView, Props>(function StoryCameraPreview(
  { facing = "front", active = false, mode = "picture", onPress },
  ref
) {
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active || permission?.granted) return;
    void requestPermission();
  }, [active, permission?.granted, requestPermission]);

  useEffect(() => {
    if (!active) setReady(false);
  }, [active]);

  if (!active) {
    return <View style={styles.wrap} />;
  }

  if (!permission?.granted) {
    return (
      <Pressable style={styles.fallback} onPress={onPress}>
        <Ionicons name="camera-outline" size={36} color="#b7ff37" />
        <Text style={styles.hint}>Tap to allow camera</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <CameraView
        ref={ref}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode={mode}
        active={active}
        onCameraReady={() => setReady(true)}
      />
      {!ready ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color="#d8ff37" />
        </View>
      ) : null}
    </View>
  );
});

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
  loading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" }
});
