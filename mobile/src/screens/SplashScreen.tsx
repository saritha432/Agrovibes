import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { useOnboarding } from "../onboarding/OnboardingContext";
import { resolveOnboardingDestination } from "../onboarding/flow";
import type { RootStackParamList } from "../navigation/RootNavigator";

export function SplashScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, loading: authLoading } = useAuth();
  const { state: ob, loading: obLoading } = useOnboarding();

  React.useEffect(() => {
    if (authLoading || (token && obLoading)) return;
    const dest = resolveOnboardingDestination(!!token, ob);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: dest as keyof RootStackParamList }]
      })
    );
  }, [authLoading, obLoading, token, ob, navigation]);

  return (
    <View style={styles.root}>
      <Text style={styles.wordmark}>Agrovibes</Text>
      <ActivityIndicator size="large" color="#0a9f46" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f5f4", alignItems: "center", justifyContent: "center" },
  wordmark: { fontSize: 28, fontWeight: "900", color: "#0f3d2e", letterSpacing: -0.5 },
  spinner: { marginTop: 20 }
});
