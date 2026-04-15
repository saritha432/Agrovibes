import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppTopBar } from "../components/AppTopBar";
import { CommunityQuestion, fetchCommunityQuestions } from "../services/api";

export function CommunityScreen() {
  const [questions, setQuestions] = useState<CommunityQuestion[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    fetchCommunityQuestions()
      .then((data) => {
        if (!mounted) return;
        setQuestions(data.questions);
      })
      .catch(() => {
        if (!mounted) return;
        setErrorMessage("Backend unavailable, showing fallback questions.");
        setQuestions([
          {
            id: 1,
            userName: "Mahesh Rao",
            district: "Nagpur",
            textContent: "The leaves on my orange trees are turning yellow. Any remedy?",
            upvotes: 45,
            answersCount: 2,
            isResolved: true,
            createdAt: "2026-04-10T00:00:00.000Z"
          },
          {
            id: 2,
            userName: "Pradeep Kumar",
            district: "Indore",
            textContent: "Heavy whitefly infestation on soybean. How to control organically?",
            upvotes: 21,
            answersCount: 3,
            isResolved: false,
            createdAt: "2026-04-11T00:00:00.000Z"
          }
        ]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollBottom}>
      <AppTopBar />
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Community</Text>
        <Text style={styles.sectionSub}>Learn from 50,000+ farmers</Text>
      </View>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      {questions.map((item) => (
        <View key={item.id} style={styles.questionCard}>
          <View style={styles.questionTop}>
            <Text style={styles.userName}>{item.userName}</Text>
            <Text style={styles.dateLabel}>4d ago</Text>
          </View>
          <Text style={styles.userDistrict}>📍 {item.district}</Text>
          <Text style={styles.questionText}>{item.textContent}</Text>
          <View style={styles.questionFooter}>
            <Text style={styles.answerMeta}>👍 {item.upvotes}</Text>
            <Text style={styles.answerMeta}>💬 {item.answersCount} answers</Text>
            {item.isResolved ? (
              <View style={styles.resolvedChip}>
                <Text style={styles.resolvedText}>Resolved</Text>
              </View>
            ) : null}
          </View>
        </View>
      ))}
      <Pressable style={styles.askFab}>
        <Text style={styles.askFabText}>🎤 Ask Question</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  scrollBottom: { paddingBottom: 90 },
  sectionHeader: { paddingHorizontal: 12, paddingVertical: 10 },
  sectionTitle: { fontSize: 32, fontWeight: "700", color: "#121716" },
  sectionSub: { color: "#4b5a56", marginTop: 3, fontWeight: "500" },
  errorText: { color: "#b45309", fontWeight: "600", paddingHorizontal: 12, marginBottom: 8 },
  questionCard: { backgroundColor: "#fff", marginHorizontal: 12, marginTop: 10, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#dce3e1" },
  questionTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  userName: { fontSize: 16, fontWeight: "700", color: "#212b29" },
  userDistrict: { color: "#5c6d69", marginBottom: 8 },
  dateLabel: { color: "#667775" },
  questionText: { color: "#111616", fontSize: 20, lineHeight: 28, marginTop: 4 },
  questionFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  answerMeta: { color: "#5b6966", fontWeight: "500" },
  resolvedChip: { backgroundColor: "#e8f8ef", borderWidth: 1, borderColor: "#75cc9b", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  resolvedText: { color: "#0a9f46", fontWeight: "700" },
  askFab: { marginTop: 14, marginRight: 12, marginLeft: "auto", backgroundColor: "#0a9f46", borderRadius: 28, paddingHorizontal: 18, paddingVertical: 12 },
  askFabText: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
