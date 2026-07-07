import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterSubBottomSheet } from "../components/accountCenter/AccountCenterSubBottomSheet";
import { ProfilesPersonalDetailsContent } from "../components/accountCenter/ProfilesPersonalDetailsContent";
import type { RootStackParamList } from "../navigation/rootStackTypes";

export function ProfilesPersonalDetailsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <AccountCenterSubBottomSheet visible onClose={() => navigation.goBack()}>
      <ProfilesPersonalDetailsContent />
    </AccountCenterSubBottomSheet>
  );
}
