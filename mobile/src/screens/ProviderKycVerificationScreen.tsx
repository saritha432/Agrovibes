import React, { useCallback, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_LIME } from "../theme/appColors";
import {
  PROVIDER_CARD,
  PROVIDER_MUTED,
  PROVIDER_TEXT,
  ProviderContinueButton,
  ProviderFormHeader,
  ProviderStepBar,
  providerFormStyles as pf
} from "./provider/providerFormUi";
import { updateProviderRegistrationDraft } from "../services/providerWorkflow";

type DocKey =
  | "aadhaarFront"
  | "aadhaarBack"
  | "driverLicense"
  | "governmentId"
  | "vehicleRc"
  | "panCard"
  | "farmerId";

type DocField = {
  key: DocKey;
  label: string;
  placeholder: string;
  required: boolean;
};

const RENTAL_DOC_FIELDS: DocField[] = [
  {
    key: "aadhaarFront",
    label: "Aadhar Card Front *",
    placeholder: "Upload Aadhar card front",
    required: true
  },
  {
    key: "aadhaarBack",
    label: "Aadhar Card Back *",
    placeholder: "Upload Aadhar card back",
    required: true
  },
  {
    key: "driverLicense",
    label: "Driver License Copy *",
    placeholder: "Upload Driver License copy",
    required: true
  },
  {
    key: "vehicleRc",
    label: "Vehicle RC | Equipment Ownership Proof *",
    placeholder: "Upload Vehicle RC / Ownership proof",
    required: true
  },
  {
    key: "panCard",
    label: "Pan Card (Optional)",
    placeholder: "Upload Pan card",
    required: false
  }
];

const SERVICE_DOC_FIELDS: DocField[] = [
  {
    key: "aadhaarFront",
    label: "Aadhaar Card Front *",
    placeholder: "Upload Aadhaar card front",
    required: true
  },
  {
    key: "aadhaarBack",
    label: "Aadhaar Card Back *",
    placeholder: "Upload Aadhaar card back",
    required: true
  },
  {
    key: "governmentId",
    label: "Government ID Type *",
    placeholder: "Upload Government ID Type",
    required: true
  },
  {
    key: "vehicleRc",
    label: "Vehicle RC / Equipment Ownership Proof *",
    placeholder: "Upload Vehicle RC / Equipment Ownership Proof",
    required: true
  },
  {
    key: "farmerId",
    label: "Farmer ID (optional)",
    placeholder: "Upload Farmer ID",
    required: false
  }
];

function UploadDocCard({
  field,
  uri,
  onPick
}: {
  field: DocField;
  uri?: string;
  onPick: () => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{field.label}</Text>
      <Pressable
        style={[styles.uploadBox, uri ? styles.uploadBoxDone : null]}
        onPress={onPick}
        accessibilityRole="button"
        accessibilityLabel={field.placeholder}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.uploadInner}>
            <Text style={styles.uploadPlaceholder}>{field.placeholder}</Text>
          </View>
        )}
        {uri ? (
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark" size={12} color="#000" />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export function ProviderKycVerificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const track = route.params?.track === "service" || route.params?.track === "both" ? route.params.track : "rental";
  const fields = useMemo(
    () => (track === "service" || track === "both" ? SERVICE_DOC_FIELDS : RENTAL_DOC_FIELDS),
    [track]
  );
  const [docs, setDocs] = useState<Partial<Record<DocKey, string>>>({});

  const pickDoc = useCallback(async (key: DocKey) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to upload KYC documents.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.uri) return;
    setDocs((prev) => ({ ...prev, [key]: asset.uri }));
  }, []);

  const requiredOk = fields.filter((f) => f.required).every((f) => !!docs[f.key]);

  return (
    <SafeAreaView style={pf.screen} edges={["top", "bottom"]}>
      <ProviderFormHeader onBack={() => navigation.goBack()} />
      <ProviderStepBar currentStep={3} />

      <ScrollView
        style={pf.scroll}
        contentContainerStyle={pf.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>KYC Verification</Text>
        <Text style={styles.sub}>Upload clear photos or scans</Text>

        {fields.map((field) => (
          <UploadDocCard
            key={field.key}
            field={field}
            uri={docs[field.key]}
            onPick={() => void pickDoc(field.key)}
          />
        ))}

        <View style={{ height: 16 }} />
      </ScrollView>

      <ProviderContinueButton
        disabled={!requiredOk}
        onPress={() => {
          const labels = fields
            .filter((f) => !!docs[f.key])
            .map((f) => f.label.replace(/\s*\*$/, "").trim());
          void updateProviderRegistrationDraft({
            track,
            documentLabels: labels
          });
          navigation.navigate("ProviderVerification", { track });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: {
    color: APP_LIME,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 6
  },
  sub: {
    color: PROVIDER_MUTED,
    fontSize: 13,
    marginBottom: 18
  },
  fieldBlock: { marginBottom: 14 },
  fieldLabel: {
    color: PROVIDER_TEXT,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8
  },
  uploadBox: {
    minHeight: 88,
    backgroundColor: PROVIDER_CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center"
  },
  uploadBoxDone: {
    borderColor: "rgba(201,255,53,0.45)"
  },
  uploadInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 12
  },
  uploadPlaceholder: {
    color: APP_LIME,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "600"
  },
  preview: {
    width: "100%",
    height: 140
  },
  doneBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  }
});
