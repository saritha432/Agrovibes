import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
import { AddressDetailsFields } from "./provider/AddressDetailsFields";
import { APP_LIME } from "../theme/appColors";

function MobileOtpActions({
  phone,
  phoneDigits,
  otp,
  otpSent,
  phoneVerified,
  otpError,
  busy,
  onChangePhone,
  onChangeOtp,
  onGetOtp,
  onVerify
}: {
  phone: string;
  phoneDigits: string;
  otp: string;
  otpSent: boolean;
  phoneVerified: boolean;
  otpError: string;
  busy: boolean;
  onChangePhone: (value: string) => void;
  onChangeOtp: (value: string) => void;
  onGetOtp: () => void;
  onVerify: () => void;
}) {
  const readyToVerify = otpSent && otp.length === 6 && !phoneVerified;
  const canPress = phoneVerified ? false : readyToVerify ? !busy : phoneDigits.length === 10 && !busy;
  const sideLabel = phoneVerified
    ? "Verified"
    : busy
      ? readyToVerify
        ? "Verifying…"
        : "Sending…"
      : readyToVerify
        ? "Verify OTP"
        : "Get OTP";
  return (
    <View style={otpUi.wrap}>
      <View style={otpUi.phoneRow}>
        <TextInput
          style={[pf.input, otpUi.phoneInput]}
          value={phone}
          onChangeText={onChangePhone}
          placeholder="Mobile Number *"
          placeholderTextColor={PROVIDER_MUTED}
          keyboardType="phone-pad"
          maxLength={14}
          editable={!phoneVerified}
        />
        {phoneVerified ? (
          <Text style={otpUi.verified}>Verified</Text>
        ) : (
          <Pressable
            style={[otpUi.getBtn, !canPress && otpUi.btnOff]}
            onPress={readyToVerify ? onVerify : onGetOtp}
            disabled={!canPress}
            accessibilityRole="button"
          >
            <Text style={[otpUi.getBtnText, !canPress && otpUi.btnTextOff]}>{sideLabel}</Text>
          </Pressable>
        )}
      </View>
      {otpSent && !phoneVerified ? (
        <TextInput
          style={otpUi.otpInput}
          value={otp}
          onChangeText={onChangeOtp}
          placeholder="Enter 6-digit OTP"
          placeholderTextColor={PROVIDER_MUTED}
          keyboardType="number-pad"
          maxLength={6}
        />
      ) : null}
      {otpError ? <Text style={otpUi.error}>{otpError}</Text> : null}
    </View>
  );
}

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
  const [pinCode, setPinCode] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpReqId, setOtpReqId] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [busy, setBusy] = useState(false);
  const phoneDigits = phone.replace(/\D/g, "").slice(-10);
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
      pinCode.length === 6 &&
      emailOk
    : fullName.trim().length > 1 &&
      phone.trim().length >= 10 &&
      phoneVerified &&
      street.trim().length > 0 &&
      village.trim().length > 0 &&
      district.trim().length > 0 &&
      stateName.trim().length > 0 &&
      pinCode.length === 6 &&
      emailOk;

  const onPhoneChange = (value: string) => {
    setPhone(value);
    setPhoneVerified(false);
    setOtpSent(false);
    setOtpReqId("");
    setOtp("");
    setOtpError("");
  };

  const sendOtp = async () => {
    if (phoneDigits.length < 10) {
      setOtpError("Enter a 10-digit mobile number first.");
      return;
    }
    if (!token) {
      setOtpError("Sign in again, then verify the mobile number.");
      return;
    }
    setBusy(true);
    setOtpError("");
    try {
      const sent = await sendProviderOtpWithMsg91(token, phoneDigits);
      if (sent.verified) {
        setPhoneVerified(true);
        setOtpSent(true);
        return;
      }
      setOtpReqId(sent.reqId);
      setOtp("");
      setOtpSent(true);
    } catch (error) {
      setOtpSent(false);
      setOtpError(error instanceof Error ? error.message : "Could not send the OTP.");
    } finally {
      setBusy(false);
    }
  };

  const checkOtp = async () => {
    if (!token) {
      setOtpError("Sign in again, then verify the mobile number.");
      return;
    }
    if (!otpReqId) {
      setOtpError("Tap Get OTP, then enter the code.");
      return;
    }
    if (otp.replace(/\D/g, "").length !== 6) {
      setOtpError("Enter the 6-digit OTP.");
      return;
    }
    setBusy(true);
    setOtpError("");
    try {
      await verifyProviderOtpWithMsg91(token, phoneDigits, otpReqId, otp.replace(/\D/g, ""));
      setPhoneVerified(true);
    } catch (error) {
      setPhoneVerified(false);
      setOtpError(error instanceof Error ? error.message : "That code was not accepted.");
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
      street: street.trim(),
      village: village.trim(),
      district: district.trim(),
      state: stateName.trim(),
      pinCode,
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
            <MobileOtpActions
              phone={phone}
              phoneDigits={phoneDigits}
              otp={otp}
              otpSent={otpSent}
              phoneVerified={phoneVerified}
              otpError={otpError}
              busy={busy}
              onChangePhone={onPhoneChange}
              onChangeOtp={(value) => {
                setOtp(value.replace(/\D/g, "").slice(0, 6));
                setOtpError("");
              }}
              onGetOtp={() => void sendOtp()}
              onVerify={() => void checkOtp()}
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
            <AddressDetailsFields
              address={street}
              stateName={stateName}
              district={district}
              city={village}
              pinCode={pinCode}
              onChangeAddress={setStreet}
              onChangeState={setStateName}
              onChangeDistrict={setDistrict}
              onChangeCity={setVillage}
              onChangePin={setPinCode}
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
            <MobileOtpActions
              phone={phone}
              phoneDigits={phoneDigits}
              otp={otp}
              otpSent={otpSent}
              phoneVerified={phoneVerified}
              otpError={otpError}
              busy={busy}
              onChangePhone={onPhoneChange}
              onChangeOtp={(value) => {
                setOtp(value.replace(/\D/g, "").slice(0, 6));
                setOtpError("");
              }}
              onGetOtp={() => void sendOtp()}
              onVerify={() => void checkOtp()}
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

            <AddressDetailsFields
              address={street}
              stateName={stateName}
              district={district}
              city={village}
              pinCode={pinCode}
              onChangeAddress={setStreet}
              onChangeState={setStateName}
              onChangeDistrict={setDistrict}
              onChangeCity={setVillage}
              onChangePin={setPinCode}
            />
          </>
        )}
      </ScrollView>

      <ProviderContinueButton disabled={!canContinue} onPress={onContinue} />
    </SafeAreaView>
  );
}

const otpUi = StyleSheet.create({
  wrap: { marginBottom: 8 },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  phoneInput: { flex: 1, marginBottom: 0 },
  getBtn: {
    backgroundColor: APP_LIME,
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center"
  },
  getBtnText: { color: "#000", fontSize: 14, fontWeight: "800" },
  otpInput: {
    backgroundColor: "#2b2c2e",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#f8fafc",
    fontSize: 18,
    letterSpacing: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 10
  },
  verifyBtn: {
    alignSelf: "flex-start",
    backgroundColor: APP_LIME,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 8
  },
  verifyBtnText: { color: "#000", fontSize: 14, fontWeight: "800" },
  btnOff: { backgroundColor: "#3a3a3a" },
  btnTextOff: { color: "#888" },
  verified: { color: APP_LIME, fontSize: 14, fontWeight: "800", paddingHorizontal: 4 },
  error: { color: "#ff8a80", fontSize: 13, marginBottom: 8 }
});
