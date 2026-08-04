import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ProviderChromeHeader } from "./ProviderChrome";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../../theme/appColors";

const BG = "#303132";
const CARD = "#333";

export function ProviderProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const switchToFarmerApp = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Main" }]
      })
    );
  };

  return (
    <View style={styles.screen}>
      <ProviderChromeHeader />
      <View style={styles.body}>
        <Text style={styles.title}>Provider Profile</Text>
        <Text style={styles.sub}>Manage your business account and switch apps.</Text>

        <Pressable style={styles.card} onPress={switchToFarmerApp} accessibilityRole="button">
          <Text style={styles.cardTitle}>Switch to Cropvibe Feed</Text>
          <Text style={styles.cardSub}>Go back to the farmer / social home experience.</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  title: { color: APP_LIME, fontSize: 24, fontWeight: "800" },
  sub: { color: APP_TEXT_MUTED, fontSize: 13, marginTop: 6, marginBottom: 20 },
  card: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.35)"
  },
  cardTitle: { color: APP_TEXT, fontSize: 15, fontWeight: "700" },
  cardSub: { color: APP_TEXT_MUTED, fontSize: 12, marginTop: 4, lineHeight: 17 }
});
