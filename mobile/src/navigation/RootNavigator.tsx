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
import { SavedSettingsScreen } from "../screens/SavedSettingsScreen";
import { YourActivityScreen } from "../screens/YourActivityScreen";
import { YourActivityLikesScreen } from "../screens/YourActivityLikesScreen";
import { YourActivityCommentsScreen } from "../screens/YourActivityCommentsScreen";
import { YourActivityMentionsTagsScreen } from "../screens/YourActivityMentionsTagsScreen";
import { YourActivityRecentlyDeletedScreen } from "../screens/YourActivityRecentlyDeletedScreen";
import { YourActivityPostsScreen } from "../screens/YourActivityPostsScreen";
import { YourActivityDropsScreen } from "../screens/YourActivityDropsScreen";
import { YourActivityInterestedScreen } from "../screens/YourActivityInterestedScreen";
import { YourActivityNotInterestedScreen } from "../screens/YourActivityNotInterestedScreen";
import { YourActivityRecentSearchesScreen } from "../screens/YourActivityRecentSearchesScreen";
import { YourActivityWatchHistoryScreen } from "../screens/YourActivityWatchHistoryScreen";
import { YourActivitySharesScreen } from "../screens/YourActivitySharesScreen";
import { YourActivityHighlightsScreen } from "../screens/YourActivityHighlightsScreen";
import { YourActivityArchivedScreen } from "../screens/YourActivityArchivedScreen";
import { YourActivityTimeManagementScreen } from "../screens/YourActivityTimeManagementScreen";
import { YourActivityLinkHistoryScreen } from "../screens/YourActivityLinkHistoryScreen";
import { YourActivityAccountHistoryScreen } from "../screens/YourActivityAccountHistoryScreen";
import { LanguageTranslationsScreen } from "../screens/LanguageTranslationsScreen";
import { NotificationsSettingsScreen } from "../screens/NotificationsSettingsScreen";
import { AccountCenterScreen } from "../screens/AccountCenterScreen";
import { ProfilesPersonalDetailsScreen } from "../screens/ProfilesPersonalDetailsScreen";
import { PasswordSecurityScreen } from "../screens/PasswordSecurityScreen";
import { ChangePasswordScreen } from "../screens/ChangePasswordScreen";
import { TwoFactorAuthScreen } from "../screens/TwoFactorAuthScreen";
import { EmailVerificationScreen } from "../screens/EmailVerificationScreen";
import { VerificationSelfieScreen } from "../screens/VerificationSelfieScreen";
import { SaveLoginScreen } from "../screens/SaveLoginScreen";
import { WhereLoggedInScreen } from "../screens/WhereLoggedInScreen";
import { LoginActivityScreen } from "../screens/LoginActivityScreen";
import { LoginDeviceDetailScreen } from "../screens/LoginDeviceDetailScreen";
import { SecurityCheckupScreen } from "../screens/SecurityCheckupScreen";
import { ConnectedExperiencesScreen } from "../screens/ConnectedExperiencesScreen";
import { SharingAcrossProfilesScreen } from "../screens/SharingAcrossProfilesScreen";
import { MemoriesFromInstagramScreen } from "../screens/MemoriesFromInstagramScreen";
import { ShowingProfileLinksScreen } from "../screens/ShowingProfileLinksScreen";
import { SyncingProfilePicturesScreen } from "../screens/SyncingProfilePicturesScreen";
import { ManagingAvatarsScreen } from "../screens/ManagingAvatarsScreen";
import { YourInformationPermissionsScreen } from "../screens/YourInformationPermissionsScreen";
import { AboutAccountsCentreScreen } from "../screens/AboutAccountsCentreScreen";
import { SearchHistoryScreen } from "../screens/SearchHistoryScreen";
import { AutoClearSearchHistoryScreen } from "../screens/AutoClearSearchHistoryScreen";
import { HowAutoClearingWorksScreen } from "../screens/HowAutoClearingWorksScreen";
import { ActivityOffCropvibeScreen } from "../screens/ActivityOffCropvibeScreen";
import { ActivityAcrossPartnersScreen } from "../screens/ActivityAcrossPartnersScreen";
import { ConfirmItsYouScreen } from "../screens/ConfirmItsYouScreen";
import { ClearPreviousActivityScreen } from "../screens/ClearPreviousActivityScreen";
import { WhatYouShouldKnowScreen } from "../screens/WhatYouShouldKnowScreen";
import { UploadContactsScreen } from "../screens/UploadContactsScreen";
import { ConnectedAppsScreen } from "../screens/ConnectedAppsScreen";
import { PrivacyScreen } from "../screens/PrivacyScreen";
import { BlockedAccountsScreen } from "../screens/BlockedAccountsScreen";
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
        name="SavedSettings"
        component={SavedSettingsScreen}
        options={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="YourActivity"
        component={YourActivityScreen}
        options={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="YourActivityLikes"
        component={YourActivityLikesScreen}
        options={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="YourActivityComments"
        component={YourActivityCommentsScreen}
        options={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="YourActivityMentionsTags"
        component={YourActivityMentionsTagsScreen}
        options={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="YourActivityRecentlyDeleted"
        component={YourActivityRecentlyDeletedScreen}
        options={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen name="YourActivityPosts" component={YourActivityPostsScreen} options={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: socialDiscoveryTheme.bg } }} />
      <Stack.Screen name="YourActivityDrops" component={YourActivityDropsScreen} options={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: socialDiscoveryTheme.bg } }} />
      <Stack.Screen name="YourActivityInterested" component={YourActivityInterestedScreen} options={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: socialDiscoveryTheme.bg } }} />
      <Stack.Screen name="YourActivityNotInterested" component={YourActivityNotInterestedScreen} options={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: socialDiscoveryTheme.bg } }} />
      <Stack.Screen name="YourActivityRecentSearches" component={YourActivityRecentSearchesScreen} options={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: socialDiscoveryTheme.bg } }} />
      <Stack.Screen name="YourActivityWatchHistory" component={YourActivityWatchHistoryScreen} options={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: socialDiscoveryTheme.bg } }} />
      <Stack.Screen name="YourActivityShares" component={YourActivitySharesScreen} options={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: socialDiscoveryTheme.bg } }} />
      <Stack.Screen name="YourActivityHighlights" component={YourActivityHighlightsScreen} options={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: socialDiscoveryTheme.bg } }} />
      <Stack.Screen name="YourActivityArchived" component={YourActivityArchivedScreen} options={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: socialDiscoveryTheme.bg } }} />
      <Stack.Screen name="YourActivityTimeManagement" component={YourActivityTimeManagementScreen} options={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: socialDiscoveryTheme.bg } }} />
      <Stack.Screen name="YourActivityLinkHistory" component={YourActivityLinkHistoryScreen} options={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: socialDiscoveryTheme.bg } }} />
      <Stack.Screen name="YourActivityAccountHistory" component={YourActivityAccountHistoryScreen} options={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: socialDiscoveryTheme.bg } }} />
      <Stack.Screen name="LanguageTranslations" component={LanguageTranslationsScreen} options={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: socialDiscoveryTheme.bg } }} />
      <Stack.Screen
        name="NotificationsSettings"
        component={NotificationsSettingsScreen}
        options={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="AccountCenter"
        component={AccountCenterScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: "transparent" }
        }}
      />
      <Stack.Screen
        name="ProfilesPersonalDetails"
        component={ProfilesPersonalDetailsScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: "transparent" }
        }}
      />
      <Stack.Screen
        name="PasswordSecurity"
        component={PasswordSecurityScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: "transparent" }
        }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: "transparent" }
        }}
      />
      <Stack.Screen
        name="TwoFactorAuth"
        component={TwoFactorAuthScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="VerificationSelfie"
        component={VerificationSelfieScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="SaveLogin"
        component={SaveLoginScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="WhereLoggedIn"
        component={WhereLoggedInScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="LoginActivity"
        component={LoginActivityScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="LoginDeviceDetail"
        component={LoginDeviceDetailScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="SecurityCheckup"
        component={SecurityCheckupScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="ConnectedExperiences"
        component={ConnectedExperiencesScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: "transparent" }
        }}
      />
      <Stack.Screen
        name="SharingAcrossProfiles"
        component={SharingAcrossProfilesScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: "transparent" }
        }}
      />
      <Stack.Screen
        name="MemoriesFromInstagram"
        component={MemoriesFromInstagramScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: "transparent" }
        }}
      />
      <Stack.Screen
        name="ShowingProfileLinks"
        component={ShowingProfileLinksScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: "transparent" }
        }}
      />
      <Stack.Screen
        name="SyncingProfilePictures"
        component={SyncingProfilePicturesScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: "transparent" }
        }}
      />
      <Stack.Screen
        name="ManagingAvatars"
        component={ManagingAvatarsScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="YourInformationPermissions"
        component={YourInformationPermissionsScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: "transparent" }
        }}
      />
      <Stack.Screen
        name="AboutAccountsCentre"
        component={AboutAccountsCentreScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="SearchHistory"
        component={SearchHistoryScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: "transparent" }
        }}
      />
      <Stack.Screen
        name="AutoClearSearchHistory"
        component={AutoClearSearchHistoryScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: "transparent" }
        }}
      />
      <Stack.Screen
        name="HowAutoClearingWorks"
        component={HowAutoClearingWorksScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: "transparent" }
        }}
      />
      <Stack.Screen
        name="ActivityOffCropvibe"
        component={ActivityOffCropvibeScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: "transparent" }
        }}
      />
      <Stack.Screen
        name="ActivityAcrossPartners"
        component={ActivityAcrossPartnersScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="ConfirmItsYou"
        component={ConfirmItsYouScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="ClearPreviousActivity"
        component={ClearPreviousActivityScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="WhatYouShouldKnow"
        component={WhatYouShouldKnowScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="UploadContacts"
        component={UploadContactsScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen
        name="ConnectedApps"
        component={ConnectedAppsScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          contentStyle: { backgroundColor: socialDiscoveryTheme.bg }
        }}
      />
      <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BlockedAccounts" component={BlockedAccountsScreen} options={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: socialDiscoveryTheme.bg } }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
