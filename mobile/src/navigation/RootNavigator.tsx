import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppNavigator } from "./AppNavigator";
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
import type { RootStackParamList } from "./rootStackTypes";
import { socialDiscoveryTheme } from "../theme/socialDiscoveryTheme";
import { useAuth } from "../auth/AuthContext";

export type { MainTabParamList, RootStackParamList } from "./rootStackTypes";

const Stack = createNativeStackNavigator<RootStackParamList>();

const slideRightBg = {
  headerShown: false,
  animation: "slide_from_right" as const,
  contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
};

const slideBottomBg = {
  headerShown: false,
  animation: "slide_from_bottom" as const,
  contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
};

const slideBottomTransparent = {
  headerShown: false,
  presentation: "transparentModal" as const,
  animation: "slide_from_bottom" as const,
  contentStyle: { backgroundColor: "transparent" }
};

export function RootNavigator() {
  const { token, user } = useAuth();
  const hasSession = Boolean(token || user);

  return (
    <Stack.Navigator
      initialRouteName={hasSession ? "Main" : "InitialSetup"}
      screenOptions={{ headerShown: false }}
    >
      {/* Eager: cold path for login / session restore */}
      <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: "none" }} />
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

      {/* Lazy: settings / activity / profile stacks — parsed only when opened */}
      <Stack.Screen
        name="InstructorStudio"
        getComponent={() => require("../screens/InstructorStudioScreen").InstructorStudioScreen}
      />
      <Stack.Screen
        name="EditProfile"
        getComponent={() => require("../screens/EditProfileScreen").EditProfileScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="PublicProfile"
        getComponent={() => require("../screens/ProfileScreen").ProfileScreen}
        options={{
          headerShown: false,
          contentStyle: { backgroundColor: "#262626" }
        }}
      />
      <Stack.Screen
        name="DirectChat"
        getComponent={() => require("../screens/messaging/DirectChatScreen").DirectChatScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SettingsMenu"
        getComponent={() => require("../screens/SettingsMenuScreen").SettingsMenuScreen}
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="SavedSettings"
        getComponent={() => require("../screens/SavedSettingsScreen").SavedSettingsScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivity"
        getComponent={() => require("../screens/YourActivityScreen").YourActivityScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityLikes"
        getComponent={() => require("../screens/YourActivityLikesScreen").YourActivityLikesScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityComments"
        getComponent={() => require("../screens/YourActivityCommentsScreen").YourActivityCommentsScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityMentionsTags"
        getComponent={() => require("../screens/YourActivityMentionsTagsScreen").YourActivityMentionsTagsScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityRecentlyDeleted"
        getComponent={() => require("../screens/YourActivityRecentlyDeletedScreen").YourActivityRecentlyDeletedScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityPosts"
        getComponent={() => require("../screens/YourActivityPostsScreen").YourActivityPostsScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityDrops"
        getComponent={() => require("../screens/YourActivityDropsScreen").YourActivityDropsScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityInterested"
        getComponent={() => require("../screens/YourActivityInterestedScreen").YourActivityInterestedScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityNotInterested"
        getComponent={() => require("../screens/YourActivityNotInterestedScreen").YourActivityNotInterestedScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityRecentSearches"
        getComponent={() => require("../screens/YourActivityRecentSearchesScreen").YourActivityRecentSearchesScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityWatchHistory"
        getComponent={() => require("../screens/YourActivityWatchHistoryScreen").YourActivityWatchHistoryScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityShares"
        getComponent={() => require("../screens/YourActivitySharesScreen").YourActivitySharesScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityHighlights"
        getComponent={() => require("../screens/YourActivityHighlightsScreen").YourActivityHighlightsScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityArchived"
        getComponent={() => require("../screens/YourActivityArchivedScreen").YourActivityArchivedScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityTimeManagement"
        getComponent={() => require("../screens/YourActivityTimeManagementScreen").YourActivityTimeManagementScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityLinkHistory"
        getComponent={() => require("../screens/YourActivityLinkHistoryScreen").YourActivityLinkHistoryScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="YourActivityAccountHistory"
        getComponent={() => require("../screens/YourActivityAccountHistoryScreen").YourActivityAccountHistoryScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="LanguageTranslations"
        getComponent={() => require("../screens/LanguageTranslationsScreen").LanguageTranslationsScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="NotificationsSettings"
        getComponent={() => require("../screens/NotificationsSettingsScreen").NotificationsSettingsScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="AccountCenter"
        getComponent={() => require("../screens/AccountCenterScreen").AccountCenterScreen}
        options={slideBottomTransparent}
      />
      <Stack.Screen
        name="ProfilesPersonalDetails"
        getComponent={() => require("../screens/ProfilesPersonalDetailsScreen").ProfilesPersonalDetailsScreen}
        options={slideBottomTransparent}
      />
      <Stack.Screen
        name="PasswordSecurity"
        getComponent={() => require("../screens/PasswordSecurityScreen").PasswordSecurityScreen}
        options={slideBottomTransparent}
      />
      <Stack.Screen
        name="ChangePassword"
        getComponent={() => require("../screens/ChangePasswordScreen").ChangePasswordScreen}
        options={slideBottomTransparent}
      />
      <Stack.Screen
        name="TwoFactorAuth"
        getComponent={() => require("../screens/TwoFactorAuthScreen").TwoFactorAuthScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="EmailVerification"
        getComponent={() => require("../screens/EmailVerificationScreen").EmailVerificationScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="VerificationSelfie"
        getComponent={() => require("../screens/VerificationSelfieScreen").VerificationSelfieScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="SaveLogin"
        getComponent={() => require("../screens/SaveLoginScreen").SaveLoginScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="WhereLoggedIn"
        getComponent={() => require("../screens/WhereLoggedInScreen").WhereLoggedInScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="LoginActivity"
        getComponent={() => require("../screens/LoginActivityScreen").LoginActivityScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="LoginDeviceDetail"
        getComponent={() => require("../screens/LoginDeviceDetailScreen").LoginDeviceDetailScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="SecurityCheckup"
        getComponent={() => require("../screens/SecurityCheckupScreen").SecurityCheckupScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="ConnectedExperiences"
        getComponent={() => require("../screens/ConnectedExperiencesScreen").ConnectedExperiencesScreen}
        options={slideBottomTransparent}
      />
      <Stack.Screen
        name="SharingAcrossProfiles"
        getComponent={() => require("../screens/SharingAcrossProfilesScreen").SharingAcrossProfilesScreen}
        options={slideBottomTransparent}
      />
      <Stack.Screen
        name="MemoriesFromInstagram"
        getComponent={() => require("../screens/MemoriesFromInstagramScreen").MemoriesFromInstagramScreen}
        options={slideBottomTransparent}
      />
      <Stack.Screen
        name="ShowingProfileLinks"
        getComponent={() => require("../screens/ShowingProfileLinksScreen").ShowingProfileLinksScreen}
        options={slideBottomTransparent}
      />
      <Stack.Screen
        name="SyncingProfilePictures"
        getComponent={() => require("../screens/SyncingProfilePicturesScreen").SyncingProfilePicturesScreen}
        options={slideBottomTransparent}
      />
      <Stack.Screen
        name="ManagingAvatars"
        getComponent={() => require("../screens/ManagingAvatarsScreen").ManagingAvatarsScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="YourInformationPermissions"
        getComponent={() => require("../screens/YourInformationPermissionsScreen").YourInformationPermissionsScreen}
        options={slideBottomTransparent}
      />
      <Stack.Screen
        name="AboutAccountsCentre"
        getComponent={() => require("../screens/AboutAccountsCentreScreen").AboutAccountsCentreScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="SearchHistory"
        getComponent={() => require("../screens/SearchHistoryScreen").SearchHistoryScreen}
        options={slideBottomTransparent}
      />
      <Stack.Screen
        name="AutoClearSearchHistory"
        getComponent={() => require("../screens/AutoClearSearchHistoryScreen").AutoClearSearchHistoryScreen}
        options={slideBottomTransparent}
      />
      <Stack.Screen
        name="HowAutoClearingWorks"
        getComponent={() => require("../screens/HowAutoClearingWorksScreen").HowAutoClearingWorksScreen}
        options={slideBottomTransparent}
      />
      <Stack.Screen
        name="ActivityOffCropvibe"
        getComponent={() => require("../screens/ActivityOffCropvibeScreen").ActivityOffCropvibeScreen}
        options={slideBottomTransparent}
      />
      <Stack.Screen
        name="ActivityAcrossPartners"
        getComponent={() => require("../screens/ActivityAcrossPartnersScreen").ActivityAcrossPartnersScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="ConfirmItsYou"
        getComponent={() => require("../screens/ConfirmItsYouScreen").ConfirmItsYouScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="ClearPreviousActivity"
        getComponent={() => require("../screens/ClearPreviousActivityScreen").ClearPreviousActivityScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="WhatYouShouldKnow"
        getComponent={() => require("../screens/WhatYouShouldKnowScreen").WhatYouShouldKnowScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="UploadContacts"
        getComponent={() => require("../screens/UploadContactsScreen").UploadContactsScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="ConnectedApps"
        getComponent={() => require("../screens/ConnectedAppsScreen").ConnectedAppsScreen}
        options={slideBottomBg}
      />
      <Stack.Screen
        name="Privacy"
        getComponent={() => require("../screens/PrivacyScreen").PrivacyScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BlockedAccounts"
        getComponent={() => require("../screens/BlockedAccountsScreen").BlockedAccountsScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="About"
        getComponent={() => require("../screens/AboutScreen").AboutScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
