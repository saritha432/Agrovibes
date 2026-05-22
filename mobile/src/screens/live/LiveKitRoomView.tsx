import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

type LiveKitRoomViewProps = {
  visible: boolean;
  roomName: string;
  isHost: boolean;
  title: string;
  onClose?: () => void;
};

export function LiveKitRoomView({ visible, roomName, isHost, title }: LiveKitRoomViewProps) {
  if (!visible) return null;
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>
        {Platform.OS === "web"
          ? "LiveKit web streaming is loading..."
          : "Live streaming demo is available on web. Native support needs a LiveKit native build."}
      </Text>
      <Text style={styles.room}>{roomName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000", padding: 24 },
  title: { color: "#fff", fontSize: 18, fontWeight: "900", textAlign: "center" },
  message: { marginTop: 10, color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: "700", textAlign: "center" },
  room: { marginTop: 8, color: "#C9FF35", fontSize: 11, fontWeight: "800", textAlign: "center" }
});
