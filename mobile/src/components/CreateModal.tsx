import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

interface CreateModalProps {
  visible: boolean;
  onClose: () => void;
}

const createItems = [
  { title: "Post Video", subtitle: "Share your farm story", icon: "📹" },
  { title: "List Produce", subtitle: "Sell your harvest", icon: "🌱" },
  { title: "Ask Community", subtitle: "Get farming advice", icon: "💬" }
];

export function CreateModal({ visible, onClose }: CreateModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>What would you like to create ?</Text>
          {createItems.map((item) => (
            <Pressable key={item.title} style={styles.modalItem}>
              <View style={styles.modalIcon}>
                <Text style={styles.modalIconText}>{item.icon}</Text>
              </View>
              <View>
                <Text style={styles.modalItemTitle}>{item.title}</Text>
                <Text style={styles.modalItemSub}>{item.subtitle}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.30)", padding: 16 },
  modalCard: { backgroundColor: "#fff", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#e5ece8", marginBottom: 72 },
  modalTitle: { textAlign: "center", color: "#6b7976", fontWeight: "600", marginBottom: 10 },
  modalItem: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#f4f4ef", padding: 11, borderRadius: 12, marginVertical: 4 },
  modalIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#d99a00", alignItems: "center", justifyContent: "center" },
  modalIconText: { color: "#fff" },
  modalItemTitle: { color: "#1b2422", fontWeight: "700", fontSize: 17 },
  modalItemSub: { color: "#697774" }
});
