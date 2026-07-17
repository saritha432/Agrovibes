import "fast-text-encoding";
import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { navigationRef } from "./src/navigation/navigationRef";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { OnboardingProvider } from "./src/onboarding/OnboardingContext";
import { CartProvider } from "./src/cart/CartContext";
import { LanguageProvider } from "./src/localization/LanguageContext";
import { LanguageSync } from "./src/localization/LanguageSync";
import { useAppFonts } from "./src/hooks/useAppFonts";
import { APP_BLACK } from "./src/theme/appColors";
import { PushNotificationBootstrap } from "./src/push/PushNotificationBootstrap";
import { IncomingCallNotificationBootstrap } from "./src/push/IncomingCallNotificationBootstrap";
import { CallSignalBootstrap } from "./src/push/CallSignalBootstrap";
import { GlobalIncomingCallHost } from "./src/push/GlobalIncomingCallHost";
import { SocketChatBootstrap } from "./src/messaging/SocketChatBootstrap";
import { FirebaseBootstrap } from "./src/firebase/FirebaseBootstrap";
import { ReelDeepLinkBootstrap } from "./src/navigation/ReelDeepLinkBootstrap";
import { trackNavigationScreen } from "./src/navigation/analyticsNavigation";
import { runPendingNotificationNavigation } from "./src/push/notificationNavigation";
import { setupDirectMessageNotificationCategory, ensureIncomingCallCategoriesReady, setupMissedCallNotificationCategory } from "./src/push/pushNotifications";

void setupDirectMessageNotificationCategory();
void ensureIncomingCallCategoriesReady();
void setupMissedCallNotificationCategory();

const CROPVIBE_INTRO_IMAGE = require("./assets/onboarding/cropvibe_intro.png");

/** Keep intro visible long enough to read, even when fonts/auth finish instantly. */
const INTRO_MIN_MS = 1600;

function IntroBootScreen() {
  return (
    <View style={styles.bootRoot}>
      <Image source={CROPVIBE_INTRO_IMAGE} style={styles.bootImage} resizeMode="cover" />
    </View>
  );
}

/** One boot gate: fonts + restore saved login, then open the app (no second auth splash). */
function AppShell() {
  const { ready: fontsReady } = useAppFonts();
  const { loading: authLoading } = useAuth();
  const [introMinElapsed, setIntroMinElapsed] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setIntroMinElapsed(true), INTRO_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!fontsReady || authLoading || !introMinElapsed) {
    return <IntroBootScreen />;
  }

  return (
    <>
      <LanguageSync />
      <PushNotificationBootstrap />
      <IncomingCallNotificationBootstrap />
      <CallSignalBootstrap />
      <GlobalIncomingCallHost />
      <SocketChatBootstrap />
      <FirebaseBootstrap />
      <ReelDeepLinkBootstrap />
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          trackNavigationScreen();
          runPendingNotificationNavigation();
        }}
        onStateChange={() => {
          trackNavigationScreen();
          runPendingNotificationNavigation();
        }}
      >
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <LanguageProvider>
        <AuthProvider>
          <OnboardingProvider>
            <CartProvider>
              <AppShell />
            </CartProvider>
          </OnboardingProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootRoot: { flex: 1, backgroundColor: APP_BLACK },
  bootImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" }
});
