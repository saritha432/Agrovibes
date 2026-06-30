import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_BLACK, APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

type InfoRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
};

function InfoRow({ icon, text }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={20} color={APP_LIME} />
      </View>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

export function VerificationSelfieScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.grabber} />
      <Pressable
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={24} color={APP_LIME} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Verification Selfie</Text>

        <View style={styles.preview} />

        <Text style={styles.sectionTitle}>Save a verification selfie for profile recovery</Text>
        <Text style={styles.sectionDescription}>
          If you ever lose access to your profile, we'll ask you to provide a new selfie which will be
          matched with this securely stored verification selfie to confirm your identity.
        </Text>

        <View style={styles.infoList}>
          <InfoRow
            icon="lock-closed-outline"
            text="Your video selfie will only be used to confirm your identity for safety, security or authenticity purposes."
          />
          <InfoRow
            icon="eye-off-outline"
            text="Your video selfie won't be visible on your profile."
          />
          <InfoRow
            icon="trash-outline"
            text="You can delete or update your selfie whenever you want."
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.submitBtn}
          onPress={() =>
            Alert.alert("Coming soon", "Verification selfie capture will be available in a future update.")
          }
          accessibilityRole="button"
          accessibilityLabel="Next"
        >
          <Text style={styles.submitBtnText}>Next</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: APP_BLACK
  },
  grabber: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#5a5a5a",
    marginTop: 6,
    marginBottom: 8
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16
  },
  title: {
    color: APP_TEXT,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20
  },
  preview: {
    height: 220,
    borderRadius: 12,
    backgroundColor: APP_SURFACE,
    marginBottom: 24
  },
  sectionTitle: {
    color: APP_TEXT,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 10
  },
  sectionDescription: {
    color: APP_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22
  },
  infoList: {
    gap: 18
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14
  },
  infoIconWrap: {
    width: 28,
    alignItems: "center",
    paddingTop: 2
  },
  infoText: {
    flex: 1,
    color: APP_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 20
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8
  },
  submitBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  submitBtnText: {
    color: APP_BLACK,
    fontSize: 16,
    fontWeight: "700"
  }
});
