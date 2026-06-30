import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterSubLayout } from "../components/accountCenter/AccountCenterSubLayout";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_ON_LIME } from "../theme/appColors";

export function ActivityAcrossPartnersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(false);

  const tryAgain = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 700);
  };

  const next = () => {
    navigation.navigate("ConfirmItsYou", {
      title: "Confirm It's You",
      description:
        "Information we receive from our partners can include browsing activity, crop recommendations and farming services that help us deliver personalized insights.",
      action: "managePartnerActivity"
    });
  };

  return (
    <AccountCenterSubLayout
      title="Your Activity Across CropVibe Partners"
      description={
        <Text style={styles.description}>
          Information we receive from our partners can include browsing activity, crop recommendations and farming
          services that help us deliver personalized insights.
        </Text>
      }
      contentStyle={styles.content}
    >
      <View style={styles.heroPlaceholder} />

      <View style={styles.actions}>
        <Pressable
          style={[styles.secondaryBtn, loading && styles.btnDisabled]}
          onPress={tryAgain}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>{loading ? "Loading..." : "Try Again"}</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={next} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Next</Text>
        </Pressable>
      </View>
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  description: {
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 21
  },
  content: {
    paddingBottom: 24
  },
  heroPlaceholder: {
    height: 200,
    borderRadius: 14,
    backgroundColor: APP_SURFACE,
    marginBottom: 24
  },
  actions: {
    gap: 12
  },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: APP_SURFACE,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryBtnText: {
    color: APP_LIME,
    fontSize: 15,
    fontWeight: "700"
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryBtnText: {
    color: APP_TEXT_ON_LIME,
    fontSize: 15,
    fontWeight: "700"
  },
  btnDisabled: {
    opacity: 0.6
  }
});
