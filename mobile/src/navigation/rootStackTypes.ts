import type { NavigatorScreenParams } from "@react-navigation/native";
import type { MarketStackParamList } from "./MarketStackNavigator";
import type { LearnStackParamList } from "./LearnStackNavigator";

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Market: NavigatorScreenParams<MarketStackParamList>;
  Learn: NavigatorScreenParams<LearnStackParamList>;
  Services: undefined;
  Messages: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  InitialSetup: undefined;
  AuthChoice: { initialMode?: "register" | "login"; passwordResetSuccess?: boolean; loginPhone?: string } | undefined;
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
  PublicProfile: { userId?: number; userName: string; userKey?: string; avatarUrl?: string | null };
  DirectChat: {
    peerUserId: number;
    peerName: string;
    peerKey?: string;
    peerUsername?: string;
    peerAvatarUrl?: string | null;
    incomingCall?: { roomName: string; mode: "voice" | "video"; callerId: number };
  };
  SettingsMenu: undefined;
  AccountCenter: undefined;
  ProfilesPersonalDetails: undefined;
  PasswordSecurity: undefined;
  ChangePassword: undefined;
  Privacy: undefined;
  About: undefined;
};
