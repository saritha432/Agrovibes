import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

const DIVIDER = "rgba(255,255,255,0.08)";
const CARD = "#2a2d31";

export function YourActivityTimeManagementScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={22} color={APP_LIME} /></Pressable>
        <Text style={styles.topTitle}>Time Management</Text>
        <View style={styles.backBtn} />
      </View>
      <View style={styles.card}>
        <Row label="Today" value="1h 26m" />
        <Row label="Past 7 days" value="7h 54m" />
        <Row label="Past 30 days" value="22h 11m" />
        <Row label="Average / day" value="44m" />
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_BLACK, paddingHorizontal: 12 },
  topBar: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { color: APP_LIME, fontSize: 18, fontWeight: "700" },
  card: { marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: DIVIDER, backgroundColor: CARD, overflow: "hidden" },
  row: { minHeight: 54, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: DIVIDER, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLabel: { color: APP_TEXT, fontSize: 14 },
  rowValue: { color: APP_TEXT_MUTED, fontSize: 14, fontWeight: "700" }
});
