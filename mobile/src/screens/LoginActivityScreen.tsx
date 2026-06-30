import React, { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AccountCenterCard,
  AccountCenterChevronRow,
  AccountCenterSectionTitle,
  AccountCenterSubLayout
} from "../components/accountCenter/AccountCenterSubLayout";
import { LoginDeviceIcon } from "../components/accountCenter/LoginDeviceIcon";
import { LoginActivityDeployBanner } from "../components/accountCenter/LoginActivityDeployBanner";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { fetchLoginSessions, type LoginSession } from "../services/api";
import { formatSessionDetail } from "../utils/loginActivityFormatters";
import { getLoginDevicePayload } from "../utils/deviceInfo";
import { APP_LIME, APP_TEXT_MUTED } from "../theme/appColors";

export function LoginActivityScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "LoginActivity">>();
  const { token, refreshToken, user } = useAuth();
  const accountName = route.params?.accountName;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDevice, setCurrentDevice] = useState<LoginSession | null>(null);
  const [otherDevices, setOtherDevices] = useState<LoginSession[]>([]);
  const [legacyFallback, setLegacyFallback] = useState(false);

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
      const current = data.sessions.find((session) => session.isCurrent) || null;
      const others = data.sessions.filter((session) => !session.isCurrent);
      setCurrentDevice(current);
      setOtherDevices(others);
      setLegacyFallback(Boolean(data.legacyFallback));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load login activity");
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

  const openDevice = (sessionId: string) => navigation.navigate("LoginDeviceDetail", { sessionId });

  return (
    <AccountCenterSubLayout
      title="Login Activity"
      description={
        <Text style={{ color: "#97a0a8", fontSize: 14, lineHeight: 21 }}>
          You're Currently Logged In On These Devices.
          {accountName ? ` (${accountName})` : ""}
        </Text>
      }
    >
      <LoginActivityDeployBanner visible={legacyFallback} />
      {loading ? (
        <ActivityIndicator color={APP_LIME} style={{ marginTop: 8 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          {currentDevice ? (
            <>
              <AccountCenterSectionTitle title="This Device" />
              <AccountCenterCard>
                <AccountCenterChevronRow
                  title={currentDevice.deviceName}
                  subtitle={formatSessionDetail(currentDevice.locationLabel, currentDevice.lastActiveAt)}
                  onPress={() => openDevice(currentDevice.id)}
                  left={<LoginDeviceIcon platform={currentDevice.platform} />}
                  titleColor={APP_LIME}
                />
              </AccountCenterCard>
            </>
          ) : null}

          <AccountCenterSectionTitle title="Logins On Other Devices" />
          <AccountCenterCard>
            {otherDevices.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No other active logins.</Text>
              </View>
            ) : (
              otherDevices.map((device, index) => (
                <AccountCenterChevronRow
                  key={device.id}
                  title={device.deviceName}
                  subtitle={formatSessionDetail(device.locationLabel, device.lastActiveAt)}
                  onPress={() => openDevice(device.id)}
                  showDivider={index < otherDevices.length - 1}
                  left={<LoginDeviceIcon platform={device.platform} />}
                  titleColor={!device.isRecognized ? "#fbbf24" : undefined}
                />
              ))
            )}
          </AccountCenterCard>

          {otherDevices.some((device) => !device.isRecognized) ? (
            <Text style={styles.hintText}>Unrecognized devices are highlighted in amber.</Text>
          ) : null}
        </>
      )}
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: "#f87171",
    fontSize: 14,
    lineHeight: 20
  },
  emptyWrap: {
    paddingHorizontal: 14,
    paddingVertical: 18
  },
  emptyText: {
    color: APP_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 20
  },
  hintText: {
    color: APP_TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12
  }
});
