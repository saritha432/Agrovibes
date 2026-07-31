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

export function ProviderPersonalDetailsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const track = route.params?.track === "service" || route.params?.track === "both" ? route.params.track : "rental";
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [street, setStreet] = useState("");
  const [village, setVillage] = useState("");
  const [district, setDistrict] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");

  const canContinue =
    fullName.trim().length > 1 &&
    street.trim().length > 0 &&
    village.trim().length > 0 &&
    district.trim().length > 0;

  return (
    <SafeAreaView style={pf.screen} edges={["top", "bottom"]}>
      <ProviderFormHeader onBack={() => navigation.goBack()} />
      <ProviderStepBar currentStep={2} />

      <ScrollView
        style={pf.scroll}
        contentContainerStyle={pf.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={pf.sectionTitle}>Personal Information</Text>
        <Text style={pf.sectionSub}>Tell us about yourself</Text>

        <TextInput
          style={pf.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter as per Aadhar Name"
          placeholderTextColor={PROVIDER_MUTED}
          autoCapitalize="words"
        />
        <TextInput
          style={pf.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Enter Phone Number"
          placeholderTextColor={PROVIDER_MUTED}
          keyboardType="phone-pad"
        />

        <Text style={[pf.sectionTitle, { marginTop: 10, fontSize: 18 }]}>Farm / Business Name</Text>
        <Text style={pf.sectionSub}>Where farmers can find you</Text>

        <TextInput
          style={pf.input}
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Enter Business Name"
          placeholderTextColor={PROVIDER_MUTED}
        />
        <TextInput
          style={pf.input}
          value={street}
          onChangeText={setStreet}
          placeholder="Enter Street / House No. *"
          placeholderTextColor={PROVIDER_MUTED}
        />
        <TextInput
          style={pf.input}
          value={village}
          onChangeText={setVillage}
          placeholder="Enter Village / Town *"
          placeholderTextColor={PROVIDER_MUTED}
        />
        <TextInput
          style={pf.input}
          value={district}
          onChangeText={setDistrict}
          placeholder="Enter District *"
          placeholderTextColor={PROVIDER_MUTED}
        />
        <TextInput
          style={pf.input}
          value={yearsExperience}
          onChangeText={setYearsExperience}
          placeholder="Enter Years of Experience"
          placeholderTextColor={PROVIDER_MUTED}
          keyboardType="numeric"
        />
      </ScrollView>

      <ProviderContinueButton
        disabled={!canContinue}
        onPress={() => navigation.navigate("ProviderBankDetails", { track })}
      />
    </SafeAreaView>
  );
}
