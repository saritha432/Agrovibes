import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_LIME } from "../../theme/appColors";

const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"] as const;

type Props = {
  visible: boolean;
  timestampLabel?: string;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onReact: (emoji: string) => void;
};

export function ChatMessageActionSheet({
  visible,
  timestampLabel,
  onClose,
  onReply,
  onCopy,
  onForward,
  onReact
}: Props) {
  const insets = useSafeAreaInsets();

  const run = (fn: () => void) => {
    onClose();
    requestAnimationFrame(fn);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={() => undefined}>
          <View style={styles.emojiRow}>
            {QUICK_EMOJIS.map((emoji) => (
              <Pressable key={emoji} style={styles.emojiBtn} onPress={() => run(() => onReact(emoji))}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </View>

          {timestampLabel ? <Text style={styles.timestamp}>{timestampLabel}</Text> : null}

          <Pressable style={styles.menuRow} onPress={() => run(onReply)}>
            <Ionicons name="arrow-undo-outline" size={22} color="#fff" />
            <Text style={styles.menuLabel}>Reply</Text>
          </Pressable>

          <Pressable style={styles.menuRow} onPress={() => run(onCopy)}>
            <Ionicons name="copy-outline" size={22} color="#fff" />
            <Text style={styles.menuLabel}>Copy</Text>
          </Pressable>

          <Pressable style={styles.menuRow} onPress={() => run(onForward)}>
            <Ionicons name="paper-plane-outline" size={22} color="#fff" />
            <Text style={styles.menuLabel}>Forward</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end"
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: "#2a2a2a",
    overflow: "hidden"
  },
  emojiRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)"
  },
  emojiBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21
  },
  emojiText: { fontSize: 26 },
  timestamp: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 4,
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)"
  },
  menuLabel: { color: "#fff", fontSize: 16, fontWeight: "600" }
});
