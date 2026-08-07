import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { lookupIfsc, resolveBankAccountName } from "../services/api";
import {
  getProviderRegistrationDraft,
  updateProviderRegistrationDraft
} from "../services/providerWorkflow";

export function ProviderBankDetailsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const track = route.params?.track === "service" || route.params?.track === "both" ? route.params.track : "rental";
  const registrationType =
    route.params?.registrationType === "business" ? "business" : "individual";

  const [holderName, setHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankLocation, setBankLocation] = useState("");
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscError, setIfscError] = useState<string | null>(null);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameHint, setNameHint] = useState<string | null>(null);
  const ifscTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameAutoFilledFor = useRef<string>("");

  const accountDigits = accountNumber.replace(/\D/g, "");
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

  const runAccountNameResolve = useCallback(async (account: string, code: string) => {
    if (account.length < 6 || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) return;
    const key = `${account}:${code}`;
    if (nameAutoFilledFor.current === key) return;
    setNameLoading(true);
    setNameHint(null);
    try {
      const draft = await getProviderRegistrationDraft();
      const suggested = draft?.fullName?.trim() || "";
      const result = await resolveBankAccountName({
        accountNumber: account,
        ifsc: code,
        suggestedName: suggested || undefined
      });
      if (result.holderName) {
        setHolderName(result.holderName);
        nameAutoFilledFor.current = key;
        setNameHint(
          result.verified
            ? "Account holder name verified from bank."
            : "Account holder name suggested. Please confirm it matches your bank records."
        );
      } else if (suggested) {
        setHolderName(suggested);
        nameAutoFilledFor.current = key;
        setNameHint("Suggested from your profile name. Please confirm with bank records.");
      } else {
        setNameHint("Enter the account holder name exactly as on the passbook.");
      }
    } catch {
      const draft = await getProviderRegistrationDraft();
      if (draft?.fullName) {
        setHolderName(draft.fullName);
        nameAutoFilledFor.current = key;
        setNameHint("Suggested from your profile name. Please confirm with bank records.");
      } else {
        setNameHint("Enter the account holder name exactly as on the passbook.");
      }
    } finally {
      setNameLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ifscTimer.current) clearTimeout(ifscTimer.current);
    ifscTimer.current = setTimeout(() => {
      void runIfscLookup(ifscCode);
    }, 450);
    return () => {
      if (ifscTimer.current) clearTimeout(ifscTimer.current);
    };
  }, [ifscCode, runIfscLookup]);

  useEffect(() => {
    if (nameTimer.current) clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(() => {
      void runAccountNameResolve(accountDigits, ifscCode);
    }, 700);
    return () => {
      if (nameTimer.current) clearTimeout(nameTimer.current);
    };
  }, [accountDigits, ifscCode, runAccountNameResolve]);

  const canContinue =
    holderName.trim().length > 1 &&
    accountDigits.length >= 6 &&
    ifscFormatOk &&
    bankName.trim().length > 1 &&
    !ifscLoading;

  const continueHint = !ifscFormatOk
    ? "Enter a complete 11-character IFSC code to continue."
    : accountDigits.length < 6
      ? "Enter a valid account number."
      : holderName.trim().length <= 1
        ? "Enter account holder name."
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
    navigation.navigate("ProviderKycVerification", { track, registrationType });
  };

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
        <Text style={pf.sectionTitle}>Bank Details</Text>
        <Text style={pf.sectionSub}>For receiving your earnings</Text>

        <TextInput
          style={pf.input}
          value={ifsc}
          onChangeText={(v) => setIfsc(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
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
          onChangeText={setAccountNumber}
          placeholder="Account Number *"
          placeholderTextColor={PROVIDER_MUTED}
          keyboardType="number-pad"
        />

        <TextInput
          style={pf.input}
          value={holderName}
          onChangeText={setHolderName}
          placeholder="Account Holder Name *"
          placeholderTextColor={PROVIDER_MUTED}
          autoCapitalize="words"
        />
        {nameLoading ? (
          <View style={styles.infoRow}>
            <ActivityIndicator color={APP_LIME} size="small" />
            <Text style={styles.infoText}>Fetching account holder name…</Text>
          </View>
        ) : null}
        {nameHint && !nameLoading ? <Text style={styles.hintText}>{nameHint}</Text> : null}
        {continueHint ? <Text style={styles.errorText}>{continueHint}</Text> : null}
      </ScrollView>

      <ProviderContinueButton disabled={!canContinue} onPress={onContinue} />
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
