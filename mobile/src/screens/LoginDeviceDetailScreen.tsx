import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterCard, AccountCenterSubLayout } from "../components/accountCenter/AccountCenterSubLayout";
import { LoginDeviceIcon } from "../components/accountCenter/LoginDeviceIcon";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import {
  fetchLoginSession,
  reportLoginSession,
  revokeLoginSession,
  type LoginSession
} from "../services/api";
import { formatSessionDetail, formatSessionTimestamp } from "../utils/loginActivityFormatters";
import { APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

export function LoginDeviceDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "LoginDeviceDetail">>();
  const { token, signOut } = useAuth();
  const sessionId = route.params.sessionId;
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<LoginSession | null>(null);

  const loadSession = useCallback(async () => {
    if (!token || !sessionId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await fetchLoginSession(token, sessionId);
      setSession(data.session);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load device");
    } finally {
      setLoading(false);
    }
  }, [sessionId, token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadSession();
    }, [loadSession])
  );

  const handleRevoke = () => {
    if (!token || !session) return;
    Alert.alert(
      session.isCurrent ? "Log Out This Device" : "Log Out Device",
      session.isCurrent
        ? "You will be signed out on this device."
        : `Remove access for ${session.deviceName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: session.isCurrent ? "Log Out" : "Remove",
          style: "destructive",
          onPress: async () => {
            setActing(true);
            try {
              const result = await revokeLoginSession(token, session.id);
              if (result.isCurrent) {
                await signOut();
                navigation.reset({ index: 0, routes: [{ name: "AuthChoice" }] });
                return;
              }
              navigation.goBack();
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed to log out device");
            } finally {
              setActing(false);
            }
          }
        }
      ]
    );
  };

  const handleReport = () => {
    if (!token || !session || session.isCurrent) return;
    Alert.alert(
      "This Wasn't Me",
      "We'll sign out this device and mark it as unrecognized.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report & Log Out",
          style: "destructive",
          onPress: async () => {
            setActing(true);
            try {
              await reportLoginSession(token, session.id);
              navigation.goBack();
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed to report device");
            } finally {
              setActing(false);
            }
          }
        }
      ]
    );
  };

  return (
    <AccountCenterSubLayout
      title="Device Details"
      description={
        <Text style={{ color: "#97a0a8", fontSize: 14, lineHeight: 21 }}>
          Review login details and remove access if this device looks unfamiliar.
        </Text>
      }
    >
      {loading ? (
        <ActivityIndicator color={APP_LIME} style={{ marginTop: 8 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : session ? (
        <>
          <AccountCenterCard>
            <View style={styles.heroRow}>
              <LoginDeviceIcon platform={session.platform} />
              <View style={styles.heroBody}>
                <Text style={styles.deviceName}>{session.deviceName}</Text>
                <Text style={styles.deviceMeta}>
                  {session.isCurrent ? "This device" : session.isRecognized ? "Recognized device" : "Unrecognized device"}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last active</Text>
              <Text style={styles.detailValue}>{formatSessionTimestamp(session.lastActiveAt)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Signed in</Text>
              <Text style={styles.detailValue}>{formatSessionTimestamp(session.createdAt)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>{session.locationLabel?.trim() || "Unknown location"}</Text>
            </View>
            <View style={[styles.detailRow, styles.detailRowLast]}>
              <Text style={styles.detailLabel}>Activity</Text>
              <Text style={styles.detailValue}>{formatSessionDetail(session.locationLabel, session.lastActiveAt)}</Text>
            </View>
          </AccountCenterCard>

          <Pressable
            style={[styles.primaryBtn, acting && styles.btnDisabled]}
            onPress={handleRevoke}
            disabled={acting}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>
              {session.isCurrent ? "Log Out This Device" : "Log Out Device"}
            </Text>
          </Pressable>

          {!session.isCurrent ? (
            <Pressable
              style={[styles.secondaryBtn, acting && styles.btnDisabled]}
              onPress={handleReport}
              disabled={acting}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryBtnText}>This Wasn't Me</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 16
  },
  heroBody: {
    flex: 1,
    gap: 4
  },
  deviceName: {
    color: APP_TEXT,
    fontSize: 17,
    fontWeight: "700"
  },
  deviceMeta: {
    color: APP_TEXT_MUTED,
    fontSize: 13
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3a3a3a",
    marginLeft: 14
  },
  detailRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4
  },
  detailRowLast: {
    paddingBottom: 16
  },
  detailLabel: {
    color: APP_TEXT_MUTED,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  detailValue: {
    color: APP_TEXT,
    fontSize: 14,
    lineHeight: 20
  },
  primaryBtn: {
    marginTop: 18,
    backgroundColor: APP_LIME,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  primaryBtnText: {
    color: "#262626",
    fontSize: 15,
    fontWeight: "700"
  },
  secondaryBtn: {
    marginTop: 12,
    backgroundColor: APP_SURFACE,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#f87171"
  },
  secondaryBtnText: {
    color: "#f87171",
    fontSize: 15,
    fontWeight: "700"
  },
  btnDisabled: {
    opacity: 0.6
  },
  errorText: {
    color: "#f87171",
    fontSize: 14,
    lineHeight: 20
  }
});
