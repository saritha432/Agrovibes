import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { navigationRef } from "./src/navigation/navigationRef";
import { AuthProvider } from "./src/auth/AuthContext";
import { OnboardingProvider } from "./src/onboarding/OnboardingContext";
import { CartProvider } from "./src/cart/CartContext";
import { LanguageProvider } from "./src/localization/LanguageContext";

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
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
