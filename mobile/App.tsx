import "fast-text-encoding";
import React from "react";
import { Image, InteractionManager, Platform, StatusBar, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { initialWindowMetrics, SafeAreaProvider, type Metrics } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { navigationRef } from "./src/navigation/navigationRef";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { OnboardingProvider } from "./src/onboarding/OnboardingContext";
import { CartProvider } from "./src/cart/CartContext";
import { LanguageProvider } from "./src/localization/LanguageContext";
import { LanguageSync } from "./src/localization/LanguageSync";
import { useAppFonts } from "./src/hooks/useAppFonts";
import { EnsureIosSafeAreaInsets } from "./src/safeArea/EnsureIosSafeAreaInsets";
import { APP_BLACK } from "./src/theme/appColors";
import { trackNavigationScreen } from "./src/navigation/analyticsNavigation";
import { runPendingNotificationNavigation } from "./src/push/notificationNavigation";
import { OtaUpdateBanner } from "./src/components/OtaUpdateBanner";
import { warmUpServer } from "./src/services/api";

/** Wake Railway ASAP — do not wait for fonts/auth restore. */
warmUpServer();

const CROPVIBE_INTRO_IMAGE = require("./assets/onboarding/cropvibe_intro.png");

/** Brief brand flash — keep short so cold start feels snappy. */
const INTRO_MIN_MS = 280;

/** Avoid drawing under the iOS status bar when native safe-area top is missing/0. */
function resolveInitialSafeAreaMetrics(): Metrics | undefined {
  const base = initialWindowMetrics;
  if (Platform.OS !== "ios") return base ?? undefined;
  if (!base) {
    return {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 }
    };
  }
  if ((base.insets?.top ?? 0) < 20) {
    return {
      ...base,
      insets: { ...base.insets, top: 47 }
    };
  }
  return base;
}

function IntroBootScreen() {
  return (
    <View style={styles.bootRoot}>
      <Image source={CROPVIBE_INTRO_IMAGE} style={styles.bootImage} resizeMode="cover" />
    </View>
  );
}

/**
 * Push / socket / Firebase / call hosts — start AFTER first navigation frame
 * so Home feed can paint without competing for JS thread & network.
 */
function DeferredAppServices() {
  const [services, setServices] = React.useState<{
    PushNotificationBootstrap: React.ComponentType;
    IncomingCallNotificationBootstrap: React.ComponentType;
    CallSignalBootstrap: React.ComponentType;
    GlobalIncomingCallHost: React.ComponentType;
    SocketChatBootstrap: React.ComponentType;
    FirebaseBootstrap: React.ComponentType;
    ReelDeepLinkBootstrap: React.ComponentType;
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      delayTimer = setTimeout(() => {
        if (cancelled) return;
        setServices({
          PushNotificationBootstrap: require("./src/push/PushNotificationBootstrap").PushNotificationBootstrap,
          IncomingCallNotificationBootstrap: require("./src/push/IncomingCallNotificationBootstrap")
            .IncomingCallNotificationBootstrap,
          CallSignalBootstrap: require("./src/push/CallSignalBootstrap").CallSignalBootstrap,
          GlobalIncomingCallHost: require("./src/push/GlobalIncomingCallHost").GlobalIncomingCallHost,
          SocketChatBootstrap: require("./src/messaging/SocketChatBootstrap").SocketChatBootstrap,
          FirebaseBootstrap: require("./src/firebase/FirebaseBootstrap").FirebaseBootstrap,
          ReelDeepLinkBootstrap: require("./src/navigation/ReelDeepLinkBootstrap").ReelDeepLinkBootstrap
        });
      }, 400);
    });
    return () => {
      cancelled = true;
      if (delayTimer) clearTimeout(delayTimer);
      task.cancel?.();
    };
  }, []);

  if (!services) return null;

  const {
    PushNotificationBootstrap,
    IncomingCallNotificationBootstrap,
    CallSignalBootstrap,
    GlobalIncomingCallHost,
    SocketChatBootstrap,
    FirebaseBootstrap,
    ReelDeepLinkBootstrap
  } = services;

  return (
    <>
      <PushNotificationBootstrap />
      <IncomingCallNotificationBootstrap />
      <CallSignalBootstrap />
      <GlobalIncomingCallHost />
      <SocketChatBootstrap />
      <FirebaseBootstrap />
      <ReelDeepLinkBootstrap />
    </>
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

  React.useEffect(() => {
    StatusBar.setBarStyle("light-content");
    if (Platform.OS === "android") {
      StatusBar.setTranslucent(true);
      StatusBar.setBackgroundColor("transparent");
    }
  }, []);

  if (!fontsReady || authLoading || !introMinElapsed) {
    return <IntroBootScreen />;
  }

  return (
    <>
      <LanguageSync />
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
        <OtaUpdateBanner />
      </NavigationContainer>
      <DeferredAppServices />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={resolveInitialSafeAreaMetrics()}>
      <EnsureIosSafeAreaInsets>
        <StatusBar barStyle="light-content" translucent={Platform.OS === "android"} backgroundColor="transparent" />
        <LanguageProvider>
          <AuthProvider>
            <OnboardingProvider>
              <CartProvider>
                <AppShell />
              </CartProvider>
            </OnboardingProvider>
          </AuthProvider>
        </LanguageProvider>
      </EnsureIosSafeAreaInsets>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootRoot: { flex: 1, backgroundColor: APP_BLACK },
  bootImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" }
});
