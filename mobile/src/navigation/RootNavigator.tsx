import React from "react";
import type { NavigatorScreenParams } from "@react-navigation/native";
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
import { EditProfileScreen } from "../screens/EditProfileScreen";
import { DirectChatScreen } from "../screens/messaging/DirectChatScreen";
import { DirectInboxScreen } from "../screens/messaging/DirectInboxScreen";
import { PublicProfileScreen } from "../screens/PublicProfileScreen";
import { UserSearchScreen } from "../screens/UserSearchScreen";
import { ForgotPasswordScreen } from "../screens/onboarding/ForgotPasswordScreen";
import { ForgotPasswordOtpResetScreen } from "../screens/onboarding/ForgotPasswordOtpResetScreen";
import type { MarketStackParamList } from "./MarketStackNavigator";
import type { LearnStackParamList } from "./LearnStackNavigator";

export type MainTabParamList = {
  Home: undefined;
  Market: NavigatorScreenParams<MarketStackParamList>;
  Learn: NavigatorScreenParams<LearnStackParamList>;
  Services: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  InitialSetup: undefined;
  AuthChoice: { initialMode?: "register" | "login" } | undefined;
  OtpVerify: { phone: string };
  ForgotPassword: undefined;
  ForgotPasswordOtp: { phone: string };
  PersonalInfo: undefined;
  RoleSelection: undefined;
  BuyerInterests: undefined;
  BuyerDelivery: undefined;
  BuyerWalkthrough: undefined;
  SellerFarm: undefined;
  SellerKYC: undefined;
  SellerBank: undefined;
  ExpertDomain: undefined;
  ExpertCredentials: undefined;
  ExpertVerification: undefined;
  SecurityVerification: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  InstructorStudio: undefined;
  EditProfile: undefined;
  DirectInbox: undefined;
  DirectChat: { peerUserId: number; peerName: string; peerKey?: string };
  UserSearch: undefined;
  PublicProfile: { userId?: number; userName: string; userKey?: string };
};

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
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          title: "Edit profile",
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#ffffff" },
          headerTintColor: "#0f0f0f",
          headerTitleStyle: { fontWeight: "800" as const, fontSize: 18 },
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen
        name="DirectInbox"
        component={DirectInboxScreen}
        options={{
          title: "Messages",
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#ffffff" },
          headerTintColor: "#0f0f0f",
          headerTitleStyle: { fontWeight: "800" as const, fontSize: 18 },
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen name="DirectChat" component={DirectChatScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="UserSearch"
        component={UserSearchScreen}
        options={{
          title: "Search",
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#ffffff" },
          headerTintColor: "#0f0f0f",
          headerTitleStyle: { fontWeight: "800" as const, fontSize: 18 },
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen
        name="PublicProfile"
        component={PublicProfileScreen}
        options={{
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#ffffff" },
          headerTintColor: "#0f0f0f",
          headerTitleStyle: { fontWeight: "800" as const, fontSize: 18 },
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen name="InstructorStudio" component={InstructorStudioScreen} />
    </Stack.Navigator>
  );
}
