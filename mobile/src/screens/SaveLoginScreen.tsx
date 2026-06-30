import React, { useMemo } from "react";
import { Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AccountCenterCard,
  AccountCenterChevronRow,
  AccountCenterSubLayout
} from "../components/accountCenter/AccountCenterSubLayout";
import { AccountCenterAvatar } from "../components/accountCenter/AccountCenterAvatar";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/rootStackTypes";

const ACCOUNT_TYPES = ["Media Account", "Business Account", "educator account"] as const;

export function SaveLoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  const displayName = useMemo(
    () => user?.fullName || user?.username || "Your profile",
    [user?.fullName, user?.username]
  );

  return (
    <AccountCenterSubLayout
      title="Save Login"
      description={
        <Text style={{ color: "#97a0a8", fontSize: 14, lineHeight: 21 }}>
          Select The Account For Which You Want To See Saved Login Info.
        </Text>
      }
    >
      <AccountCenterCard>
        {ACCOUNT_TYPES.map((accountType, index) => (
          <AccountCenterChevronRow
            key={accountType}
            title={displayName}
            subtitle={accountType}
            onPress={() => navigation.navigate("LoginActivity", { accountName: displayName })}
            showDivider={index < ACCOUNT_TYPES.length - 1}
            left={<AccountCenterAvatar label={displayName} avatarUrl={user?.avatarUrl} />}
          />
        ))}
      </AccountCenterCard>
    </AccountCenterSubLayout>
  );
}
