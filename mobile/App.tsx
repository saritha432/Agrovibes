import "fast-text-encoding";
import React from "react";
import { ActivityIndicator, View } from "react-native";
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
import { SocketChatBootstrap } from "./src/messaging/SocketChatBootstrap";
import { ReelDeepLinkBootstrap } from "./src/navigation/ReelDeepLinkBootstrap";

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
          <SocketChatBootstrap />
          <ReelDeepLinkBootstrap />
          <OnboardingProvider>
            <CartProvider>
              <NavigationContainer ref={navigationRef}>
                <RootNavigator />
              </NavigationContainer>
            </CartProvider>
          </OnboardingProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
