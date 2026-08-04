import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppNavigator } from "./AppNavigator";
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
  contentStyle: { backgroundColor: "transparent" },
  // Avoid native stack hairline above transparent modals (esp. web)
  freezeOnBlur: true
};

/**
 * Only Main (tabs) is eagerly imported.
 * Onboarding + settings screens load on first navigation — big cold-start win for logged-in users.
 */
export function RootNavigator() {
  const { token, user } = useAuth();
  const hasSession = Boolean(token || user);

  return (
    <Stack.Navigator
      initialRouteName={hasSession ? "Main" : "InitialSetup"}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen
        name="Splash"
        getComponent={() => require("../screens/SplashScreen").SplashScreen}
        options={{ animation: "none" }}
      />
      <Stack.Screen
        name="InitialSetup"
        getComponent={() => require("../screens/InitialSetupScreen").InitialSetupScreen}
      />
      <Stack.Screen
        name="AuthChoice"
        getComponent={() => require("../screens/onboarding/AuthChoiceScreen").AuthChoiceScreen}
      />
      <Stack.Screen
        name="OtpVerify"
        getComponent={() => require("../screens/onboarding/OtpVerifyScreen").OtpVerifyScreen}
      />
      <Stack.Screen
        name="ForgotPassword"
        getComponent={() => require("../screens/onboarding/ForgotPasswordScreen").ForgotPasswordScreen}
      />
      <Stack.Screen
        name="ForgotPasswordOtp"
        getComponent={() =>
          require("../screens/onboarding/ForgotPasswordOtpResetScreen").ForgotPasswordOtpResetScreen
        }
      />
      <Stack.Screen
        name="PersonalInfo"
        getComponent={() => require("../screens/onboarding/PersonalInfoScreen").PersonalInfoScreen}
      />
      <Stack.Screen
        name="RoleSelection"
        getComponent={() => require("../screens/onboarding/RoleSelectionScreen").RoleSelectionScreen}
      />
      <Stack.Screen
        name="BuyerInterests"
        getComponent={() => require("../screens/onboarding/BuyerInterestsScreen").BuyerInterestsScreen}
      />
      <Stack.Screen
        name="BuyerDelivery"
        getComponent={() => require("../screens/onboarding/BuyerDeliveryScreen").BuyerDeliveryScreen}
      />
      <Stack.Screen
        name="BuyerWalkthrough"
        getComponent={() => require("../screens/onboarding/BuyerWalkthroughScreen").BuyerWalkthroughScreen}
      />
      <Stack.Screen
        name="SellerFarm"
        getComponent={() => require("../screens/onboarding/SellerFarmScreen").SellerFarmScreen}
      />
      <Stack.Screen
        name="SellerKYC"
        getComponent={() => require("../screens/onboarding/SellerKycScreen").SellerKycScreen}
      />
      <Stack.Screen
        name="SellerBank"
        getComponent={() => require("../screens/onboarding/SellerBankScreen").SellerBankScreen}
      />
      <Stack.Screen
        name="ExpertDomain"
        getComponent={() => require("../screens/onboarding/ExpertDomainScreen").ExpertDomainScreen}
      />
      <Stack.Screen
        name="ExpertCredentials"
        getComponent={() => require("../screens/onboarding/ExpertCredentialsScreen").ExpertCredentialsScreen}
      />
      <Stack.Screen
        name="ExpertVerification"
        getComponent={() => require("../screens/onboarding/ExpertVerificationScreen").ExpertVerificationScreen}
      />
      <Stack.Screen
        name="SecurityVerification"
        getComponent={() => require("../screens/onboarding/SecurityVerificationScreen").SecurityVerificationScreen}
      />
      <Stack.Screen name="Main" component={AppNavigator} />
      <Stack.Screen
        name="ProviderMain"
        getComponent={() => require("./ProviderAppNavigator").ProviderAppNavigator}
        options={{ animation: "fade" }}
      />
      <Stack.Screen
        name="ProviderNewListing"
        getComponent={() =>
          require("../screens/provider/dashboard/ProviderNewListingScreen").ProviderNewListingScreen
        }
        options={slideBottomTransparent}
      />

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
        name="ProviderOnboarding"
        getComponent={() => require("../screens/ProviderOnboardingScreen").ProviderOnboardingScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="ProviderTerms"
        getComponent={() => require("../screens/ProviderTermsScreen").ProviderTermsScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="ProviderOfferRole"
        getComponent={() => require("../screens/ProviderOfferRoleScreen").ProviderOfferRoleScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="ProviderRentalForm"
        getComponent={() => require("../screens/ProviderRentalFormScreen").ProviderRentalFormScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="ProviderServiceForm"
        getComponent={() => require("../screens/ProviderServiceFormScreen").ProviderServiceFormScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="ProviderPersonalDetails"
        getComponent={() => require("../screens/ProviderPersonalDetailsScreen").ProviderPersonalDetailsScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="ProviderBankDetails"
        getComponent={() => require("../screens/ProviderBankDetailsScreen").ProviderBankDetailsScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="ProviderKycVerification"
        getComponent={() => require("../screens/ProviderKycVerificationScreen").ProviderKycVerificationScreen}
        options={slideRightBg}
      />
      <Stack.Screen
        name="ProviderVerification"
        getComponent={() => require("../screens/ProviderVerificationScreen").ProviderVerificationScreen}
        options={slideRightBg}
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
