import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type NotificationMoreOption = {
  key: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
};

type Props = {
  visible: boolean;
  options: NotificationMoreOption[];
  onClose: () => void;
};

/** Instagram-style bottom sheet for notification swipe “⋯” actions. */
export function NotificationMoreSheet({ visible, options, onClose }: Props) {
  const insets = useSafeAreaInsets();

  const run = (fn: () => void) => {
    onClose();
    requestAnimationFrame(fn);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.dim} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.handle} />
          {options.map((option, index) => (
            <Pressable
              key={option.key}
              style={[styles.row, index < options.length - 1 ? styles.rowBorder : null]}
              onPress={() => run(option.onPress)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
            >
              <Text style={[styles.rowLabel, option.danger ? styles.rowLabelDanger : null]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end"
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)"
  },
  sheet: {
    backgroundColor: "#262626",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 10,
    overflow: "hidden"
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4a4a4a",
    marginBottom: 6
  },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: "center"
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#3a3a3a"
  },
  rowLabel: {
    color: "#f5f5f5",
    fontSize: 16,
    fontWeight: "400",
    textAlign: "center"
  },
  rowLabelDanger: {
    color: "#ed4956",
    fontWeight: "600"
  }
});
