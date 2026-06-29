import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppNavigator } from "./AppNavigator";
import { InstructorStudioScreen } from "../screens/InstructorStudioScreen";
import { SplashScreen } from "../screens/SplashScreen";
import { AuthChoiceScreen } from "../screens/onboarding/AuthChoiceScreen";
import { OtpVerifyScreen } from "../screens/onboarding/OtpVerifyScreen";
import { PersonalInfoScreen } from "../screens/onboarding/PersonalInfoScreen";
import { RoleSelectionScreen } from "../screens/onboarding/RoleSelectionScreen";
import { BuyerInterestsScreen } from "../screens/onboarding/BuyerInterestsScreen";
import { BuyerDeliveryScreen } from "../screens/onboarding/BuyerDeliveryScreen";
import { BuyerWalkthroughScreen } from "../screens/onboarding/BuyerWalkthroughScreen";
import { SellerFarmScreen } from "../screens/onboarding/SellerFarmScreen";
import { SellerKycScreen } from "../screens/onboarding/SellerKycScreen";
import { SellerBankScreen } from "../screens/onboarding/SellerBankScreen";
import { ExpertDomainScreen } from "../screens/onboarding/ExpertDomainScreen";
import { ExpertCredentialsScreen } from "../screens/onboarding/ExpertCredentialsScreen";
import { ExpertVerificationScreen } from "../screens/onboarding/ExpertVerificationScreen";
import { SecurityVerificationScreen } from "../screens/onboarding/SecurityVerificationScreen";
import { InitialSetupScreen } from "../screens/InitialSetupScreen";
import { ForgotPasswordScreen } from "../screens/onboarding/ForgotPasswordScreen";
import { ForgotPasswordOtpResetScreen } from "../screens/onboarding/ForgotPasswordOtpResetScreen";
import { EditProfileScreen } from "../screens/EditProfileScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { DirectChatScreen } from "../screens/messaging/DirectChatScreen";
import { SettingsMenuScreen } from "../screens/SettingsMenuScreen";
import { AccountCenterScreen } from "../screens/AccountCenterScreen";
import { ProfilesPersonalDetailsScreen } from "../screens/ProfilesPersonalDetailsScreen";
import { PasswordSecurityScreen } from "../screens/PasswordSecurityScreen";
import { ChangePasswordScreen } from "../screens/ChangePasswordScreen";
import { PrivacyScreen } from "../screens/PrivacyScreen";
import { AboutScreen } from "../screens/AboutScreen";
import type { RootStackParamList } from "./rootStackTypes";
import { socialDiscoveryTheme } from "../theme/socialDiscoveryTheme";

export type { MainTabParamList, RootStackParamList } from "./rootStackTypes";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="InitialSetup" component={InitialSetupScreen} />
      <Stack.Screen name="AuthChoice" component={AuthChoiceScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ForgotPasswordOtp" component={ForgotPasswordOtpResetScreen} />
      <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="BuyerInterests" component={BuyerInterestsScreen} />
      <Stack.Screen name="BuyerDelivery" component={BuyerDeliveryScreen} />
      <Stack.Screen name="BuyerWalkthrough" component={BuyerWalkthroughScreen} />
      <Stack.Screen name="SellerFarm" component={SellerFarmScreen} />
      <Stack.Screen name="SellerKYC" component={SellerKycScreen} />
      <Stack.Screen name="SellerBank" component={SellerBankScreen} />
      <Stack.Screen name="ExpertDomain" component={ExpertDomainScreen} />
      <Stack.Screen name="ExpertCredentials" component={ExpertCredentialsScreen} />
      <Stack.Screen name="ExpertVerification" component={ExpertVerificationScreen} />
      <Stack.Screen name="SecurityVerification" component={SecurityVerificationScreen} />
      <Stack.Screen name="Main" component={AppNavigator} />
      <Stack.Screen name="InstructorStudio" component={InstructorStudioScreen} />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="PublicProfile"
        component={ProfileScreen}
        options={{
          headerShown: false,
          contentStyle: { backgroundColor: "#262626" }
        }}
      />
      <Stack.Screen name="DirectChat" component={DirectChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SettingsMenu" component={SettingsMenuScreen} options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen
        name="AccountCenter"
        component={AccountCenterScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="ProfilesPersonalDetails"
        component={ProfilesPersonalDetailsScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="PasswordSecurity"
        component={PasswordSecurityScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ headerShown: false }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
