import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { APP_BLACK, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel: string;
  confirmDanger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  cancelLabel = "CANCEL",
  confirmLabel,
  confirmDanger = false,
  onCancel,
  onConfirm
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Pressable hitSlop={8} onPress={onCancel} style={styles.actionBtn}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={onConfirm} style={styles.actionBtn}>
              <Text style={[styles.confirmText, confirmDanger ? styles.confirmDanger : null]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 4,
    backgroundColor: APP_BLACK,
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 14
  },
  title: {
    color: APP_TEXT,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24
  },
  message: {
    marginTop: 10,
    color: APP_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 20
  },
  actions: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 18
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4
  },
  cancelText: {
    color: APP_TEXT,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4
  },
  confirmText: {
    color: APP_TEXT,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4
  },
  confirmDanger: {
    color: "#ff6b6b"
  }
});
