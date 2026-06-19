import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_BLACK } from "../theme/appColors";

type Props = {
  visible: boolean;
  sourceUri: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ProfilePhotoCaptureReview({ visible, sourceUri, onCancel, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  if (!visible || !sourceUri) return null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <View style={styles.root}>
        <Image source={{ uri: sourceUri }} style={styles.preview} resizeMode="contain" />

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
          <Pressable style={styles.dismissBtn} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel">
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Pressable style={styles.confirmBtn} onPress={onConfirm} accessibilityRole="button" accessibilityLabel="Continue">
            <Ionicons name="checkmark" size={30} color="#111" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: APP_BLACK },
  preview: { flex: 1, width: "100%" },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 36,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.35)"
  },
  dismissBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center"
  },
  confirmBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  }
});
