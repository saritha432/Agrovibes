import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useAuth } from "../../auth/AuthContext";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import type { RootStackParamList } from "../../navigation/RootNavigator";

function stableUserId(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 900000) + 100000;
}

export function OtpVerifyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "OtpVerify">>();
  const { signIn } = useAuth();
  const [code, setCode] = React.useState("");

  const submit = async () => {
    const digits = code.replace(/\D/g, "");
    if (digits.length < 4) return;
    const phone = route.params.phone;
    await signIn({
      token: `otp-${phone}`,
      user: {
        id: stableUserId(`phone:${phone}`),
        email: `${phone}@phone.agrovibes`,
        fullName: "Farmer",
        role: "student",
        phone
      }
    });
    navigation.reset({ index: 0, routes: [{ name: "Splash" }] });
  };

  return (
    <OnboardingLayout
      title="Verify mobile"
      subtitle={`Enter the code we sent to +${route.params.phone}. Demo: any 4+ digits.`}
      primaryLabel="Verify & continue"
      onPrimary={submit}
      primaryDisabled={code.replace(/\D/g, "").length < 4}
      onBack={() => navigation.goBack()}
    >
      <Text style={styles.label}>OTP</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={8}
        placeholder="••••••"
        placeholderTextColor="#c5cdca"
        style={styles.input}
      />
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: "900", color: "#22312d", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#dce3e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 6,
    fontWeight: "800",
    color: "#111616",
    textAlign: "center"
  }
});
