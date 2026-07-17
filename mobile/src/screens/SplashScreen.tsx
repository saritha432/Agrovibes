import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { runPendingNotificationNavigation } from "../push/notificationNavigation";
import { APP_BLACK } from "../theme/appColors";

const CROPVIBE_INTRO_IMAGE = require("../../assets/onboarding/cropvibe_intro.png");

/** Shows cropvibe intro briefly, then routes to Main or InitialSetup. */
export function SplashScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user } = useAuth();

  React.useEffect(() => {
    const hasSession = Boolean(token || user);
    const timer = setTimeout(() => {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: hasSession ? "Main" : "InitialSetup" }]
        })
      );
      if (hasSession) {
        setTimeout(() => runPendingNotificationNavigation(), 0);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [token, user, navigation]);

  return (
    <View style={styles.root}>
      <Image source={CROPVIBE_INTRO_IMAGE} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: APP_BLACK },
  image: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" }
});
