import React, { useState } from "react";
import { Alert, ScrollView, Text, TextInput } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { sendProviderOtpWithMsg91, verifyProviderOtpWithMsg91 } from "../services/msg91Widget";
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
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpReqId, setOtpReqId] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const { token } = useAuth();

  const emailOk = !email.trim() || isValidEmail(email);
  const canContinue = isBusiness
    ? businessName.trim().length > 1 &&
      fullName.trim().length > 1 &&
      phone.trim().length >= 10 &&
      phoneVerified &&
      isValidEmail(email) &&
      street.trim().length > 0 &&
      village.trim().length > 0 &&
      district.trim().length > 0 &&
      stateName.trim().length > 0 &&
      emailOk
    : fullName.trim().length > 1 &&
      phone.trim().length >= 10 &&
      phoneVerified &&
      village.trim().length > 0 &&
      district.trim().length > 0 &&
      stateName.trim().length > 0 &&
      emailOk;

  const sendOtp = async () => {
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (digits.length < 10) {
      Alert.alert("Mobile number", "Enter a 10-digit mobile number first.");
      return;
    }
    if (!token) {
      Alert.alert("Sign in", "Sign in again, then verify the mobile number.");
      return;
    }
    setBusy(true);
    try {
      const sent = await sendProviderOtpWithMsg91(token, digits);
      if (sent.verified) {
        setPhoneVerified(true);
        setOtpSent(true);
        return;
      }
      setOtpReqId(sent.reqId);
      setOtpSent(true);
      Alert.alert("OTP sent", "Enter the 6-digit code sent to this mobile.");
    } catch (error) {
      Alert.alert("Could not send OTP", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy(false);
    }
  };

  const checkOtp = async () => {
    if (!token) {
      Alert.alert("Sign in", "Sign in again, then verify the mobile number.");
      return;
    }
    setBusy(true);
    try {
      if (!otpReqId) {
        Alert.alert("OTP", "Send a new code, then enter it.");
        return;
      }
      await verifyProviderOtpWithMsg91(token, phone.replace(/\D/g, "").slice(-10), otpReqId, otp);
      setPhoneVerified(true);
    } catch (error) {
      Alert.alert("OTP", error instanceof Error ? error.message : "That code was not accepted.");
    } finally {
      setBusy(false);
    }
  };

  const onContinue = () => {
    void updateProviderRegistrationDraft({
      track,
      registrationType,
      fullName: fullName.trim(),
      phone: phone.trim(),
      phoneOtpVerified: true,
      email: email.trim().toLowerCase(),
      businessName: isBusiness ? businessName.trim() : "",
      street: isBusiness ? street.trim() : "",
      village: village.trim(),
      district: district.trim(),
      state: stateName.trim(),
      gstNumber: isBusiness ? gstNumber.trim().toUpperCase() : "",
      yearsExperience: isBusiness ? yearsExperience.trim() : ""
    });
    navigation.navigate("ProviderKycVerification", { track, registrationType });
  };

  return (
    <SafeAreaView style={pf.screen} edges={["top", "bottom"]}>
      <ProviderFormHeader onBack={() => navigation.goBack()} />
      <ProviderStepBar currentStep={1} registrationType={registrationType} />

      <ScrollView
        style={pf.scroll}
        contentContainerStyle={pf.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isBusiness ? (
          <>
            <Text style={pf.sectionTitle}>Basic Details</Text>
            <Text style={pf.sectionSub}>Name, phone, email, address, and business details</Text>

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
              onChangeText={(value) => {
                setPhone(value);
                setPhoneVerified(false);
                setOtpSent(false);
                setOtpReqId("");
              }}
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
            <Text style={pf.sectionTitle}>Basic Details</Text>
            <Text style={pf.sectionSub}>Name, phone, email, and address</Text>

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
              onChangeText={(value) => {
                setPhone(value);
                setPhoneVerified(false);
                setOtpSent(false);
                setOtpReqId("");
              }}
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
        <Text style={[pf.sectionTitle, { marginTop: 16 }]}>Mobile OTP</Text>
        <Text style={pf.sectionSub}>
          {phoneVerified ? "This mobile is verified." : otpSent ? "Enter the code, then verify." : "Send a code to the mobile number above."}
        </Text>
        <TextInput
          style={pf.input}
          value={otp}
          onChangeText={setOtp}
          placeholder="6-digit OTP"
          placeholderTextColor={PROVIDER_MUTED}
          keyboardType="number-pad"
          maxLength={6}
        />
        <ProviderContinueButton
          label={busy ? "Please wait…" : phoneVerified ? "Mobile verified" : otpSent ? "Verify OTP" : "Send OTP"}
          disabled={busy || phoneVerified}
          onPress={() => void (otpSent ? checkOtp() : sendOtp())}
        />
      </ScrollView>

      <ProviderContinueButton disabled={!canContinue} onPress={onContinue} />
    </SafeAreaView>
  );
}
