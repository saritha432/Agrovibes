import React, { useCallback, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AccountCenterCard,
  AccountCenterChevronRow,
  AccountCenterSubLayout
} from "../components/accountCenter/AccountCenterSubLayout";
import { AccountCenterAvatar } from "../components/accountCenter/AccountCenterAvatar";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { readSavedLogins, type SavedLoginAccount } from "../utils/savedLogins";
import { roleAccountLabel } from "../utils/loginActivityFormatters";

export function SaveLoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SavedLoginAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const saved = await readSavedLogins();
        if (!active) return;
        if (saved.length > 0) {
          setAccounts(saved);
        } else if (user) {
          setAccounts([
            {
              userId: user.id,
              displayName: user.fullName || user.username || "Your profile",
              accountType: roleAccountLabel(user.role),
              avatarUrl: user.avatarUrl,
              role: user.role,
              lastUsedAt: new Date().toISOString()
            }
          ]);
        } else {
          setAccounts([]);
        }
        setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [user])
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
      {loading ? (
        <ActivityIndicator color="#C9FF35" style={{ marginTop: 12 }} />
      ) : (
        <AccountCenterCard>
          {accounts.map((account, index) => (
            <AccountCenterChevronRow
              key={`${account.userId}-${account.accountType}`}
              title={account.displayName}
              subtitle={account.accountType}
              onPress={() =>
                navigation.navigate("LoginActivity", {
                  accountName: account.displayName,
                  userId: account.userId
                })
              }
              showDivider={index < accounts.length - 1}
              left={<AccountCenterAvatar label={account.displayName} avatarUrl={account.avatarUrl} />}
            />
          ))}
        </AccountCenterCard>
      )}
    </AccountCenterSubLayout>
  );
}
