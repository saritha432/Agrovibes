import React, { useState } from "react";
import { ScrollView, Text, TextInput } from "react-native";
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
import { updateProviderRegistrationDraft } from "../services/providerWorkflow";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function ProviderPersonalDetailsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const track = route.params?.track === "service" || route.params?.track === "both" ? route.params.track : "rental";
  const registrationType =
    route.params?.registrationType === "business" ? "business" : "individual";
  const isBusiness = registrationType === "business";

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [street, setStreet] = useState("");
  const [village, setVillage] = useState("");
  const [district, setDistrict] = useState("");
  const [stateName, setStateName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");

  const emailOk = !email.trim() || isValidEmail(email);
  const canContinue = isBusiness
    ? businessName.trim().length > 1 &&
      fullName.trim().length > 1 &&
      phone.trim().length >= 10 &&
      isValidEmail(email) &&
      street.trim().length > 0 &&
      village.trim().length > 0 &&
      district.trim().length > 0 &&
      stateName.trim().length > 0 &&
      emailOk
    : fullName.trim().length > 1 &&
      phone.trim().length >= 10 &&
      village.trim().length > 0 &&
      district.trim().length > 0 &&
      stateName.trim().length > 0 &&
      emailOk;

  const onContinue = () => {
    void updateProviderRegistrationDraft({
      track,
      registrationType,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      businessName: isBusiness ? businessName.trim() : "",
      street: isBusiness ? street.trim() : "",
      village: village.trim(),
      district: district.trim(),
      state: stateName.trim(),
      gstNumber: isBusiness ? gstNumber.trim().toUpperCase() : "",
      yearsExperience: isBusiness ? yearsExperience.trim() : ""
    });
    navigation.navigate("ProviderBankDetails", { track, registrationType });
  };

  return (
    <SafeAreaView style={pf.screen} edges={["top", "bottom"]}>
      <ProviderFormHeader onBack={() => navigation.goBack()} />
      <ProviderStepBar currentStep={1} />

      <ScrollView
        style={pf.scroll}
        contentContainerStyle={pf.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isBusiness ? (
          <>
            <Text style={pf.sectionTitle}>Business Details</Text>

            <TextInput
              style={pf.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Business Name *"
              placeholderTextColor={PROVIDER_MUTED}
            />
            <TextInput
              style={pf.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Authorized Person Name *"
              placeholderTextColor={PROVIDER_MUTED}
              autoCapitalize="words"
            />
            <TextInput
              style={pf.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Mobile Number *"
              placeholderTextColor={PROVIDER_MUTED}
              keyboardType="phone-pad"
            />
            <TextInput
              style={pf.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email Address *"
              placeholderTextColor={PROVIDER_MUTED}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={pf.input}
              value={street}
              onChangeText={setStreet}
              placeholder="Street / House No. *"
              placeholderTextColor={PROVIDER_MUTED}
            />
            <TextInput
              style={pf.input}
              value={village}
              onChangeText={setVillage}
              placeholder="Village / Town *"
              placeholderTextColor={PROVIDER_MUTED}
            />
            <TextInput
              style={pf.input}
              value={district}
              onChangeText={setDistrict}
              placeholder="District *"
              placeholderTextColor={PROVIDER_MUTED}
            />
            <TextInput
              style={pf.input}
              value={stateName}
              onChangeText={setStateName}
              placeholder="State *"
              placeholderTextColor={PROVIDER_MUTED}
              autoCapitalize="words"
            />
            <TextInput
              style={pf.input}
              value={gstNumber}
              onChangeText={(v) => setGstNumber(v.toUpperCase())}
              placeholder="GST Number (if applicable)"
              placeholderTextColor={PROVIDER_MUTED}
              autoCapitalize="characters"
            />
            <TextInput
              style={pf.input}
              value={yearsExperience}
              onChangeText={setYearsExperience}
              placeholder="Years of Experience"
              placeholderTextColor={PROVIDER_MUTED}
              keyboardType="numeric"
            />
          </>
        ) : (
          <>
            <Text style={pf.sectionTitle}>Personal Information</Text>

            <TextInput
              style={pf.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full Name (As per Aadhaar) *"
              placeholderTextColor={PROVIDER_MUTED}
              autoCapitalize="words"
            />
            <TextInput
              style={pf.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Mobile Number *"
              placeholderTextColor={PROVIDER_MUTED}
              keyboardType="phone-pad"
            />
            <TextInput
              style={pf.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email Address (optional)"
              placeholderTextColor={PROVIDER_MUTED}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[pf.sectionTitle, { marginTop: 14, fontSize: 18 }]}>Location</Text>

            <TextInput
              style={pf.input}
              value={village}
              onChangeText={setVillage}
              placeholder="Village / Town *"
              placeholderTextColor={PROVIDER_MUTED}
            />
            <TextInput
              style={pf.input}
              value={district}
              onChangeText={setDistrict}
              placeholder="District *"
              placeholderTextColor={PROVIDER_MUTED}
            />
            <TextInput
              style={pf.input}
              value={stateName}
              onChangeText={setStateName}
              placeholder="State *"
              placeholderTextColor={PROVIDER_MUTED}
              autoCapitalize="words"
            />
          </>
        )}
      </ScrollView>

      <ProviderContinueButton disabled={!canContinue} onPress={onContinue} />
    </SafeAreaView>
  );
}
