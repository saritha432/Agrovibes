import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterSubBottomSheet } from "../components/accountCenter/AccountCenterSubBottomSheet";
import { HowAutoClearingWorksContent } from "../components/accountCenter/HowAutoClearingWorksContent";
import type { RootStackParamList } from "../navigation/rootStackTypes";

export function HowAutoClearingWorksScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <AccountCenterSubBottomSheet visible onClose={() => navigation.goBack()}>
      <HowAutoClearingWorksContent />
    </AccountCenterSubBottomSheet>
  );
}
