import "fast-text-encoding";
import "./src/push/registerNotificationHandlers";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { setupDirectMessageNotificationCategory, setupIncomingCallNotificationCategories } from "./src/push/pushNotifications";

void setupDirectMessageNotificationCategory();
void setupIncomingCallNotificationCategories();
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { navigationRef } from "./src/navigation/navigationRef";
import { AuthProvider } from "./src/auth/AuthContext";
import { OnboardingProvider } from "./src/onboarding/OnboardingContext";
import { CartProvider } from "./src/cart/CartContext";
import { LanguageProvider } from "./src/localization/LanguageContext";
import { LanguageSync } from "./src/localization/LanguageSync";
import { useAppFonts } from "./src/hooks/useAppFonts";
import { APP_BLACK, APP_LIME } from "./src/theme/appColors";
import { PushNotificationBootstrap } from "./src/push/PushNotificationBootstrap";
import { GlobalIncomingCallHost } from "./src/push/GlobalIncomingCallHost";
import { SocketChatBootstrap } from "./src/messaging/SocketChatBootstrap";
import { FirebaseBootstrap } from "./src/firebase/FirebaseBootstrap";
import { ReelDeepLinkBootstrap } from "./src/navigation/ReelDeepLinkBootstrap";
import { trackNavigationScreen } from "./src/navigation/analyticsNavigation";
import { runPendingNotificationNavigation } from "./src/push/notificationNavigation";

export default function App() {
  const { ready: fontsReady } = useAppFonts();

  if (!fontsReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: APP_BLACK }}>
        <ActivityIndicator size="large" color={APP_LIME} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <LanguageSync />
          <PushNotificationBootstrap />
          <GlobalIncomingCallHost />
          <SocketChatBootstrap />
          <FirebaseBootstrap />
          <ReelDeepLinkBootstrap />
          <OnboardingProvider>
            <CartProvider>
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
            </CartProvider>
          </OnboardingProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
