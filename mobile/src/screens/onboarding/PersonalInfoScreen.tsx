import React from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { OnboardingLayout } from "../../onboarding/OnboardingLayout";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";

export function PersonalInfoScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, updateUser, signOut } = useAuth();
  const { setPersonalInfoCompleted } = useOnboarding();

  const [fullName, setFullName] = React.useState(user?.fullName ?? "");
  const [email, setEmail] = React.useState(user?.email ?? "");
  const [dob, setDob] = React.useState(user?.dateOfBirth ?? "");
  const [language, setLanguage] = React.useState(user?.preferredLanguage ?? "");
  const [location, setLocation] = React.useState(user?.locationLabel ?? "");
  const [quickPrefs, setQuickPrefs] = React.useState(Boolean(user?.preferredLanguage || user?.locationLabel));

  const submit = async () => {
    await updateUser({
      fullName: fullName.trim() || user?.fullName || "Member",
      email: email.trim() || user?.email || "user@agrovibes.app",
      dateOfBirth: dob.trim() || undefined,
      preferredLanguage: quickPrefs ? language.trim() || undefined : undefined,
      locationLabel: quickPrefs ? location.trim() || undefined : undefined
    });
    await setPersonalInfoCompleted();
    navigation.navigate("RoleSelection");
  };

  return (
    <OnboardingLayout
      title="About you"
      subtitle="We use this to personalize Agrovibes. You can edit it anytime in profile."
      primaryLabel="Continue"
      onPrimary={submit}
      primaryDisabled={!(fullName.trim() || (user?.fullName ?? "").trim())}
      onBack={async () => {
        await signOut();
        navigation.reset({ index: 0, routes: [{ name: "AuthChoice" }] });
      }}
      showBack
    >
      <Text style={styles.label}>Full name</Text>
      <TextInput value={fullName} onChangeText={setFullName} style={styles.input} placeholder="Your name" />

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
        placeholder="you@example.com"
      />

      <Text style={styles.label}>Date of birth</Text>
      <TextInput value={dob} onChangeText={setDob} style={styles.input} placeholder="YYYY-MM-DD (optional)" />

      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleTitle}>Language & location</Text>
          <Text style={styles.toggleSub}>Optional shortcuts for regional content</Text>
        </View>
        <Switch value={quickPrefs} onValueChange={setQuickPrefs} />
      </View>

      {quickPrefs ? (
        <>
          <Text style={styles.label}>Preferred language</Text>
          <TextInput value={language} onChangeText={setLanguage} style={styles.input} placeholder="e.g. English, తెలుగు" />

          <Text style={styles.label}>Location</Text>
          <TextInput value={location} onChangeText={setLocation} style={styles.input} placeholder="District or city" />
        </>
      ) : (
        <Pressable onPress={() => setQuickPrefs(true)} style={styles.skipHint}>
          <Text style={styles.skipHintText}>Add language & location</Text>
        </Pressable>
      )}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 12, fontWeight: "900", color: "#22312d" },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#dce3e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "700",
    color: "#111616"
  },
  toggleRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8
  },
  toggleTitle: { fontWeight: "900", color: "#22312d" },
  toggleSub: { marginTop: 4, fontWeight: "600", color: "#6b7874", fontSize: 12 },
  skipHint: { marginTop: 8, alignSelf: "flex-start" },
  skipHintText: { fontWeight: "800", color: "#0a9f46", fontSize: 13 }
});
