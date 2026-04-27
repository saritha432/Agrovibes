import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { isLaunchSetupComplete } from "../onboarding/launchSetup";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { INITIAL_SETUP_SEEN_KEY } from "./InitialSetupScreen";

export function SplashScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user, loading: authLoading } = useAuth();
  const [introSeen, setIntroSeen] = React.useState<boolean | null>(null);
  const [launchSetupDone, setLaunchSetupDone] = React.useState<boolean | null>(null);

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
    let mounted = true;
    (async () => {
      if (!user?.id) {
        setLaunchSetupDone(false);
        return;
      }
      const done = await isLaunchSetupComplete(user.id);
      if (!mounted) return;
      setLaunchSetupDone(done);
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  React.useEffect(() => {
    const hasSession = Boolean(token || user);
    if (introSeen == null || authLoading || (hasSession && launchSetupDone == null)) return;
    if (!hasSession && !introSeen) {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "InitialSetup" }]
        })
      );
      return;
    }
    const dest = !hasSession ? "AuthChoice" : launchSetupDone ? "Main" : "EnableLocation";
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: dest as keyof RootStackParamList }]
      })
    );
  }, [authLoading, token, user, navigation, introSeen, launchSetupDone]);

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
