import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  PROVIDER_CARD,
  PROVIDER_MUTED,
  PROVIDER_TEXT,
  ProviderContinueButton,
  ProviderFormHeader,
  ProviderStepBar,
  providerFormStyles as pf
} from "./provider/providerFormUi";
import { APP_LIME } from "../theme/appColors";
import { useAuth } from "../auth/AuthContext";
import { lookupIfsc, verifyProviderBankAccount } from "../services/api";
import { getProviderRegistrationDraft, updateProviderRegistrationDraft } from "../services/providerWorkflow";

export function ProviderBankDetailsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const { token } = useAuth();
  const track = route.params?.track === "service" || route.params?.track === "both" ? route.params.track : "rental";
  const registrationType =
    route.params?.registrationType === "business" ? "business" : "individual";

  const [holderName, setHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccount, setConfirmAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankLocation, setBankLocation] = useState("");
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscError, setIfscError] = useState<string | null>(null);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameHint, setNameHint] = useState<string | null>(null);
  const [bankVerified, setBankVerified] = useState(false);
  const ifscTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const payouts = route.params?.purpose === "payouts";
  const accountDigits = accountNumber.replace(/\D/g, "");
  const confirmDigits = confirmAccount.replace(/\D/g, "");
  const ifscCode = ifsc.trim().toUpperCase();
  const ifscFormatOk = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode);

  const runIfscLookup = useCallback(async (code: string) => {
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) {
      setBankName("");
      setBankBranch("");
      setBankLocation("");
      if (code.length === 0) {
        setIfscError(null);
      } else if (code.length < 11) {
        setIfscError(`IFSC must be 11 characters (${code.length}/11). Example: ICIC0000400`);
      } else {
        setIfscError("Enter a valid IFSC (4 letters + 0 + 6 characters).");
      }
      return;
    }
    setIfscLoading(true);
    setIfscError(null);
    try {
      const data = await lookupIfsc(code);
      setBankName(data.bank || "");
      setBankBranch(data.branch || "");
      const location = [data.city, data.district, data.state].filter(Boolean).join(", ");
      setBankLocation(location || data.address || "");
      if (!data.bank) {
        setIfscError("Bank not found for this IFSC. Enter bank name manually below.");
      }
    } catch (error) {
      setBankBranch("");
      setBankLocation("");
      setIfscError(
        error instanceof Error
          ? `${error.message} You can still enter bank name manually.`
          : "Could not look up IFSC. Enter bank name manually."
      );
    } finally {
      setIfscLoading(false);
    }
  }, []);

  const verifyAccount = useCallback(async () => {
    if (accountDigits.length < 6 || !ifscFormatOk || nameLoading) return;
    if (!token) {
      setNameHint("Please sign in again, then verify the account.");
      return;
    }
    setNameLoading(true);
    setNameHint(null);
    setBankVerified(false);
    try {
      const draft = await getProviderRegistrationDraft();
      const address = [draft?.street, draft?.village, draft?.district, draft?.state].filter(Boolean).join(", ");
      const result = await verifyProviderBankAccount(token, {
        accountNumber: accountDigits,
        ifsc: ifscCode,
        ifscDetails: true,
        applicantName: draft?.fullName || "Provider",
        role: track,
        registrationType,
        businessName: draft?.businessName,
        gstNumber: draft?.gstNumber,
        email: draft?.email,
        phone: draft?.phone,
        address
      });
      const typed = holderName.trim().toLowerCase();
      const returned = String(result.holderName || "").trim().toLowerCase();
      const nameAgrees = !payouts || !typed || !returned || returned.includes(typed) || typed.includes(returned);
      const accepted = result.matched && nameAgrees;
      setHolderName(result.holderName || holderName);
      setBankVerified(accepted);
      setNameHint(
        accepted
          ? "Account holder matches the Aadhaar name."
          : !nameAgrees
            ? `Bank records show ${result.holderName}. Enter that name, then verify again.`
            : `Bank name is ${result.holderName}. It does not match ${result.aadhaarName}.`
      );
      if (accepted) {
        await updateProviderRegistrationDraft({
          holderName: result.holderName || holderName.trim(),
          accountNumber: accountDigits,
          ifsc: ifscCode,
          bankVerified: true
        });
        if (payouts) navigation.navigate("ProviderPayouts");
      }
    } catch (error) {
      setBankVerified(false);
      setNameHint(error instanceof Error ? error.message : "Could not verify the bank account.");
    } finally {
      setNameLoading(false);
    }
  }, [accountDigits, holderName, ifscCode, ifscFormatOk, nameLoading, navigation, payouts, token]);

  useEffect(() => {
    if (ifscTimer.current) clearTimeout(ifscTimer.current);
    ifscTimer.current = setTimeout(() => {
      void runIfscLookup(ifscCode);
    }, 450);
    return () => {
      if (ifscTimer.current) clearTimeout(ifscTimer.current);
    };
  }, [ifscCode, runIfscLookup]);

  const canContinue = bankVerified && accountDigits.length >= 6 && ifscFormatOk && bankName.trim().length > 1;

  const continueHint = !ifscFormatOk
    ? "Enter a complete 11-character IFSC code to continue."
    : accountDigits.length < 6
      ? "Enter a valid account number."
      : !bankVerified
        ? "Verify the account holder before continuing."
        : bankName.trim().length <= 1
          ? "Enter or wait for bank name from IFSC lookup."
          : null;

  const onContinue = () => {
    if (!canContinue) {
      Alert.alert(
        "Bank details incomplete",
        continueHint || "Enter a valid account number, IFSC, and account holder name."
      );
      return;
    }
    void updateProviderRegistrationDraft({
      track,
      registrationType,
      holderName: holderName.trim(),
      bankName: bankName.trim(),
      bankBranch: bankBranch.trim(),
      bankLocation: bankLocation.trim(),
      accountNumber: accountDigits,
      ifsc: ifscCode
    });
    if (route.params?.purpose === "payouts") {
      navigation.navigate("ProviderPayouts");
      return;
    }
    navigation.navigate("ProviderVerification", { track, registrationType });
  };

  return (
    <SafeAreaView style={pf.screen} edges={["top", "bottom"]}>
      <ProviderFormHeader onBack={() => navigation.goBack()} />
      {payouts ? (
        <Text style={[pf.sectionTitle, { paddingHorizontal: 16, paddingTop: 8 }]}>Add Bank Account</Text>
      ) : (
        <ProviderStepBar currentStep={4} />
      )}

      <ScrollView
        style={pf.scroll}
        contentContainerStyle={pf.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={pf.sectionTitle}>{payouts ? "Add Bank Account" : "Bank Account Verification"}</Text>
        <Text style={pf.sectionSub}>
          {payouts ? "One-time account number, IFSC, and the name on the bank account." : "Account number + IFSC → Verify account holder"}
        </Text>
        {payouts ? (
          <TextInput
            style={pf.input}
            value={holderName}
            onChangeText={(value) => {
              setHolderName(value);
              setBankVerified(false);
            }}
            placeholder="Account holder name"
            placeholderTextColor={PROVIDER_MUTED}
            autoCapitalize="words"
          />
        ) : null}

        <TextInput
          style={pf.input}
          value={ifsc}
          onChangeText={(v) => {
            setIfsc(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11));
            setBankVerified(false);
            setNameHint(null);
          }}
          placeholder="IFSC Code * (11 characters)"
          placeholderTextColor={PROVIDER_MUTED}
          autoCapitalize="characters"
          maxLength={11}
        />
        {ifscLoading ? (
          <View style={styles.infoRow}>
            <ActivityIndicator color={APP_LIME} size="small" />
            <Text style={styles.infoText}>Looking up bank…</Text>
          </View>
        ) : null}
        {ifscError ? <Text style={styles.errorText}>{ifscError}</Text> : null}
        {bankName || ifscFormatOk ? (
          <View style={styles.bankCard}>
            <Text style={styles.bankLabel}>Bank</Text>
            <TextInput
              style={styles.bankInput}
              value={bankName}
              onChangeText={setBankName}
              placeholder="Bank name *"
              placeholderTextColor={PROVIDER_MUTED}
            />
            {bankBranch ? (
              <>
                <Text style={[styles.bankLabel, { marginTop: 8 }]}>Branch</Text>
                <Text style={styles.bankValue}>{bankBranch}</Text>
              </>
            ) : null}
            {bankLocation ? (
              <>
                <Text style={[styles.bankLabel, { marginTop: 8 }]}>Location</Text>
                <Text style={styles.bankValue}>{bankLocation}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <TextInput
          style={pf.input}
          value={accountNumber}
          onChangeText={(value) => {
            setAccountNumber(value);
            setBankVerified(false);
            setNameHint(null);
          }}
          placeholder="Bank account number"
          placeholderTextColor={PROVIDER_MUTED}
          keyboardType="number-pad"
        />
        {payouts ? (
          <TextInput
            style={pf.input}
            value={confirmAccount}
            onChangeText={(value) => {
              setConfirmAccount(value);
              setBankVerified(false);
            }}
            placeholder="Confirm account number"
            placeholderTextColor={PROVIDER_MUTED}
            keyboardType="number-pad"
          />
        ) : null}

        <Pressable
          style={[styles.verifyBtn, (accountDigits.length < 6 || !ifscFormatOk || nameLoading) && styles.verifyBtnDisabled]}
          disabled={accountDigits.length < 6 || !ifscFormatOk || nameLoading}
          onPress={() => {
            if (payouts && accountDigits !== confirmDigits) {
              setNameHint("The account numbers do not match.");
              return;
            }
            if (payouts && holderName.trim().length < 2) {
              setNameHint("Enter the account holder name as it appears on the bank account.");
              return;
            }
            void verifyAccount();
          }}
        >
          {nameLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text
              style={[
                styles.verifyBtnText,
                (accountDigits.length < 6 || !ifscFormatOk || nameLoading) && styles.verifyBtnTextDisabled
              ]}
            >
              {payouts ? "Verify & Save Bank Account" : "Verify account holder"}
            </Text>
          )}
        </Pressable>

        {holderName ? (
          <View style={styles.bankCard}>
            <Text style={styles.bankLabel}>Account holder</Text>
            <Text style={styles.bankValue}>{holderName}</Text>
          </View>
        ) : null}
        {nameLoading ? (
          <View style={styles.infoRow}>
            <ActivityIndicator color={APP_LIME} size="small" />
            <Text style={styles.infoText}>Fetching account holder name…</Text>
          </View>
        ) : null}
        {nameHint && !nameLoading ? <Text style={styles.hintText}>{nameHint}</Text> : null}
        {continueHint ? <Text style={styles.errorText}>{continueHint}</Text> : null}
      </ScrollView>

      {payouts ? null : <ProviderContinueButton disabled={!canContinue} onPress={onContinue} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10
  },
  infoText: {
    color: PROVIDER_MUTED,
    fontSize: 12
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 12,
    marginBottom: 10
  },
  hintText: {
    color: PROVIDER_MUTED,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
    marginTop: -4
  },
  bankCard: {
    backgroundColor: PROVIDER_CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.28)",
    padding: 12,
    marginBottom: 12
  },
  bankLabel: {
    color: PROVIDER_MUTED,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  bankValue: {
    color: PROVIDER_TEXT,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2
  },
  verifyBtn: {
    backgroundColor: APP_LIME,
    borderRadius: 8,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  verifyBtnDisabled: { backgroundColor: PROVIDER_CARD },
  verifyBtnText: { color: "#000", fontSize: 14, fontWeight: "800" },
  verifyBtnTextDisabled: { color: PROVIDER_MUTED },
  bankInput: {
    marginTop: 4,
    color: PROVIDER_TEXT,
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 4,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)"
  }
});
