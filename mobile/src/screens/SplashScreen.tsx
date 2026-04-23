import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { useOnboarding } from "../onboarding/OnboardingContext";
import { resolveOnboardingDestination } from "../onboarding/flow";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { INITIAL_SETUP_SEEN_KEY } from "./InitialSetupScreen";

export function SplashScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user, loading: authLoading } = useAuth();
  const { state: ob, loading: obLoading } = useOnboarding();
  const [introSeen, setIntroSeen] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const seen = await AsyncStorage.getItem(INITIAL_SETUP_SEEN_KEY);
      if (!mounted) return;
      setIntroSeen(seen === "1");
    })();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    const hasSession = Boolean(token || user);
    if (introSeen == null || authLoading || (hasSession && obLoading)) return;
    if (!hasSession && !introSeen) {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "InitialSetup" }]
        })
      );
      return;
    }
    const dest = resolveOnboardingDestination(hasSession, ob);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: dest as keyof RootStackParamList }]
      })
    );
  }, [authLoading, obLoading, token, user, ob, navigation, introSeen]);

  return (
    <View style={styles.root}>
      <Text style={styles.wordmark}>Cropvibes</Text>
      <ActivityIndicator size="large" color="#0a9f46" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f5f4", alignItems: "center", justifyContent: "center" },
  wordmark: { fontSize: 28, fontWeight: "900", color: "#0f3d2e", letterSpacing: -0.5 },
  spinner: { marginTop: 20 }
});
