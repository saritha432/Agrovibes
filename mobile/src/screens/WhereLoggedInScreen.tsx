import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AccountCenterCard,
  AccountCenterChevronRow,
  AccountCenterSectionTitle,
  AccountCenterSubLayout
} from "../components/accountCenter/AccountCenterSubLayout";
import { AccountCenterAvatar } from "../components/accountCenter/AccountCenterAvatar";
import { LoginActivityDeployBanner } from "../components/accountCenter/LoginActivityDeployBanner";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { fetchLoginSessions, markDevicesReviewed } from "../services/api";
import { getLoginDevicePayload } from "../utils/deviceInfo";
import { APP_LIME } from "../theme/appColors";

export function WhereLoggedInScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, token, refreshToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasUnrecognized, setHasUnrecognized] = useState(false);
  const [platformSummaries, setPlatformSummaries] = useState<
    Array<{ platform: string; deviceName: string; extraCount: number; summary: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [legacyFallback, setLegacyFallback] = useState(false);

  const displayName = useMemo(
    () => user?.fullName || user?.username || "Your profile",
    [user?.fullName, user?.username]
  );

  const loadSessions = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await fetchLoginSessions(token, getLoginDevicePayload(user?.locationLabel));
      if (data.refreshedToken) {
        await refreshToken(data.refreshedToken);
      }
      setHasUnrecognized(data.hasUnrecognizedLogins);
      setPlatformSummaries(data.platformSummaries);
      setLegacyFallback(Boolean(data.legacyFallback));
      if (!data.legacyFallback) {
        await markDevicesReviewed(token);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, [token, refreshToken, user?.locationLabel]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadSessions();
    }, [loadSessions])
  );

  const openLoginActivity = () => navigation.navigate("LoginActivity", { accountName: displayName, userId: user?.id });

  return (
    <AccountCenterSubLayout
      title="Where You're Logged In"
      description={
        <Text style={{ color: "#97a0a8", fontSize: 14, lineHeight: 21 }}>
          See What Devices Are Used To Log In To Your Accounts.
        </Text>
      }
    >
      <LoginActivityDeployBanner visible={legacyFallback} />
      {hasUnrecognized ? (
        <Pressable style={styles.alertBanner} onPress={openLoginActivity} accessibilityRole="button">
          <Ionicons name="alert-circle" size={20} color={APP_LIME} />
          <Text style={styles.alertText}>
            We Detected Unrecognized Logins.{" "}
            <Text style={styles.alertLink}>Review Devices</Text>
          </Text>
        </Pressable>
      ) : null}

      <AccountCenterSectionTitle title="Accounts" />
      {loading ? (
        <ActivityIndicator color={APP_LIME} style={{ marginTop: 8 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <AccountCenterCard>
          {platformSummaries.length === 0 ? (
            <AccountCenterChevronRow
              title={displayName}
              subtitle="This device only"
              onPress={openLoginActivity}
              left={<AccountCenterAvatar label={displayName} avatarUrl={user?.avatarUrl} />}
            />
          ) : (
            platformSummaries.map((account, index) => (
              <AccountCenterChevronRow
                key={account.platform}
                title={displayName}
                subtitle={account.summary}
                onPress={openLoginActivity}
                showDivider={index < platformSummaries.length - 1}
                left={<AccountCenterAvatar label={displayName} avatarUrl={user?.avatarUrl} />}
              />
            ))
          )}
        </AccountCenterCard>
      )}
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  alertBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 18
  },
  alertText: {
    flex: 1,
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 20
  },
  alertLink: {
    color: APP_LIME,
    fontWeight: "700",
    textDecorationLine: "underline"
  },
  errorText: {
    color: "#f87171",
    fontSize: 14,
    lineHeight: 20
  }
});
