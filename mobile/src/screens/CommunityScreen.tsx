import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppTopBar } from "../components/AppTopBar";
import { CommunityQuestion, fetchCommunityQuestions } from "../services/api";

const groups = ["Women Circle", "Young Farmers", "Crop Groups", "FPO Network"];

export function CommunityScreen() {
  const [questions, setQuestions] = useState<CommunityQuestion[]>([]);

  useEffect(() => {
    let mounted = true;
    fetchCommunityQuestions()
      .then((data) => {
        if (mounted) setQuestions(data.questions);
      })
      .catch(() => {
        if (!mounted) return;
        setQuestions([
          { id: 1, userName: "Mahesh Rao", district: "Nagpur", textContent: "Yellow leaves on orange trees. Remedy?", upvotes: 45, answersCount: 2, isResolved: true, createdAt: "2026-04-10" },
          { id: 2, userName: "Pradeep Kumar", district: "Indore", textContent: "Whitefly in soybean, organic control?", upvotes: 21, answersCount: 3, isResolved: false, createdAt: "2026-04-11" }
        ]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBottom}>
      <AppTopBar />
      <View style={styles.header}><Text style={styles.title}>Community</Text><Text style={styles.sub}>Q and A, groups and saved learning</Text></View>

      <Text style={styles.sectionTitle}>Q and A Feed</Text>
      {questions.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.user}>{item.userName} - {item.district}</Text>
          <Text style={styles.question}>{item.textContent}</Text>
          <View style={styles.row}>
            <Text style={styles.meta}>Upvotes {item.upvotes}</Text>
            <Text style={styles.meta}>Answers {item.answersCount}</Text>
            {item.isResolved ? <Text style={styles.resolved}>Resolved</Text> : null}
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Groups</Text>
      <View style={styles.groupRow}>
        {groups.map((g) => (
          <View key={g} style={styles.groupChip}><Text style={styles.groupText}>{g}</Text></View>
        ))}
      </View>

      <View style={styles.myCommunity}>
        <Text style={styles.myTitle}>My Community</Text>
        <Text style={styles.myText}>Saved questions, followed groups and notification settings.</Text>
      </View>

      <Pressable style={styles.askFab}>
        <Ionicons name="mic-outline" size={16} color="#fff" />
        <Text style={styles.askFabText}>Ask</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  scrollBottom: { paddingBottom: 100 },
  header: { paddingHorizontal: 12, paddingVertical: 10 },
  title: { fontSize: 30, fontWeight: "700", color: "#121716" },
  sub: { color: "#4b5a56", marginTop: 3, fontWeight: "500" },
  sectionTitle: { marginTop: 10, marginHorizontal: 12, color: "#22312d", fontWeight: "700", fontSize: 17 },
  card: { backgroundColor: "#fff", marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#dce3e1" },
  user: { color: "#33443f", fontWeight: "700" },
  question: { marginTop: 6, color: "#111616", fontSize: 17 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  meta: { color: "#5b6966", fontWeight: "500" },
  resolved: { color: "#0a9f46", fontWeight: "700" },
  groupRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, marginTop: 8 },
  groupChip: { borderWidth: 1, borderColor: "#c7d5cf", borderRadius: 18, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 7 },
  groupText: { color: "#425652", fontWeight: "600" },
  myCommunity: { margin: 12, borderRadius: 12, borderWidth: 1, borderColor: "#d5dfdc", backgroundColor: "#fff", padding: 12 },
  myTitle: { fontWeight: "700", color: "#22312d", fontSize: 16 },
  myText: { color: "#61726d", marginTop: 4 },
  askFab: { marginTop: 4, marginRight: 12, marginLeft: "auto", backgroundColor: "#0a9f46", borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  askFabText: { color: "#fff", fontWeight: "700" }
});
