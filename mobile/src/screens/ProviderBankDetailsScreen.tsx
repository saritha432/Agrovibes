import React, { useState } from "react";
import { Alert, ScrollView, Text, TextInput } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  PROVIDER_MUTED,
  ProviderContinueButton,
  ProviderFormHeader,
  ProviderStepBar,
  providerFormStyles as pf
} from "./provider/providerFormUi";

export function ProviderBankDetailsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const track = route.params?.track === "service" || route.params?.track === "both" ? route.params.track : "rental";
  const [holderName, setHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccount, setConfirmAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upi, setUpi] = useState("");

  const accountDigits = accountNumber.replace(/\D/g, "");
  const confirmDigits = confirmAccount.replace(/\D/g, "");
  const accountsMatch = accountDigits.length > 0 && accountDigits === confirmDigits;

  const canContinue =
    holderName.trim().length > 1 &&
    ifsc.trim().length >= 4 &&
    accountDigits.length >= 6 &&
    accountsMatch;

  const onContinue = () => {
    if (!accountsMatch) {
      Alert.alert("Account mismatch", "Account number and confirmation must match.");
      return;
    }
    navigation.navigate("ProviderKycVerification", { track });
  };

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
        <Text style={pf.sectionTitle}>Bank Details</Text>
        <Text style={pf.sectionSub}>For receiving your earnings</Text>

        <TextInput
          style={pf.input}
          value={holderName}
          onChangeText={setHolderName}
          placeholder="Enter Account Holder Name *"
          placeholderTextColor={PROVIDER_MUTED}
          autoCapitalize="words"
        />
        <TextInput
          style={pf.input}
          value={bankName}
          onChangeText={setBankName}
          placeholder="Enter Bank Name"
          placeholderTextColor={PROVIDER_MUTED}
        />
        <TextInput
          style={pf.input}
          value={accountNumber}
          onChangeText={setAccountNumber}
          placeholder="Enter Account Number"
          placeholderTextColor={PROVIDER_MUTED}
          keyboardType="number-pad"
        />
        <TextInput
          style={pf.input}
          value={ifsc}
          onChangeText={(v) => setIfsc(v.toUpperCase())}
          placeholder="Enter IFSC Code *"
          placeholderTextColor={PROVIDER_MUTED}
          autoCapitalize="characters"
        />

        <Text style={[pf.sectionTitle, { marginTop: 8, fontSize: 18 }]}>Recheck</Text>
        <TextInput
          style={pf.input}
          value={confirmAccount}
          onChangeText={setConfirmAccount}
          placeholder="Enter Confirm Account Number"
          placeholderTextColor={PROVIDER_MUTED}
          keyboardType="number-pad"
        />

        <Text style={[pf.sectionTitle, { marginTop: 8, fontSize: 18 }]}>Optional</Text>
        <TextInput
          style={pf.input}
          value={upi}
          onChangeText={setUpi}
          placeholder="Enter UPI ID (optional)"
          placeholderTextColor={PROVIDER_MUTED}
          autoCapitalize="none"
        />
      </ScrollView>

      <ProviderContinueButton disabled={!canContinue} onPress={onContinue} />
    </SafeAreaView>
  );
}
