import React from "react";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { runPendingNotificationNavigation } from "../push/notificationNavigation";

/** Legacy route — redirects immediately (boot already handled auth in App.tsx). */
export function SplashScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user } = useAuth();

  React.useEffect(() => {
    const hasSession = Boolean(token || user);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: hasSession ? "Main" : "InitialSetup" }]
      })
    );
    if (hasSession) {
      setTimeout(() => runPendingNotificationNavigation(), 0);
    }
  }, [token, user, navigation]);

  return null;
}
