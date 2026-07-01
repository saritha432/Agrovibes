import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { AccountCenterCard, AccountCenterSectionTitle, AccountCenterSubLayout } from "../components/accountCenter/AccountCenterSubLayout";
import { useAuth } from "../auth/AuthContext";
import { readConnectedApps, toggleConnectedApp, type ConnectedApp } from "../utils/connectedAppsStorage";
import { APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

function ConnectedAppRow({
  app,
  onToggle
}: {
  app: ConnectedApp;
  onToggle: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Ionicons name={app.icon} size={22} color={APP_LIME} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{app.title}</Text>
        <Text style={styles.rowSubtitle}>{app.subtitle}</Text>
      </View>
      <Pressable
        style={[styles.connectBtn, app.connected && styles.connectBtnActive]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={app.connected ? `Disconnect ${app.title}` : `Connect ${app.title}`}
      >
        <Text style={[styles.connectBtnText, app.connected && styles.connectBtnTextActive]}>
          {app.connected ? "Connected" : "Connect"}
        </Text>
      </Pressable>
    </View>
  );
}

export function ConnectedAppsScreen() {
  const { user } = useAuth();
  const [apps, setApps] = useState<ConnectedApp[]>([]);

  const reload = useCallback(async () => {
    setApps(await readConnectedApps(user));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const toggle = async (appId: string, title: string) => {
    const next = await toggleConnectedApp(appId, user);
    setApps(next);
    const connected = next.find((app) => app.id === appId)?.connected;
    Alert.alert(
      connected ? "Connected" : "Disconnected",
      connected ? `${title} is now connected to Cropvibe.` : `${title} has been disconnected.`
    );
  };

  return (
    <AccountCenterSubLayout
      title="Connected Apps"
      description={
        <Text style={styles.description}>
          Connect trusted third-party apps and services with CropVibe to streamline your farming workflow, improve
          productivity, and securely share information when you choose.
        </Text>
      }
      contentStyle={styles.content}
    >
      <AccountCenterSectionTitle title="Productivity" />
      <AccountCenterCard>
        {apps.map((app, index) => (
          <View key={app.id}>
            <ConnectedAppRow app={app} onToggle={() => void toggle(app.id, app.title)} />
            {index < apps.length - 1 ? <View style={styles.divider} /> : null}
          </View>
        ))}
      </AccountCenterCard>
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  description: {
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 21
  },
  content: {
    paddingBottom: 40
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12
  },
  iconWrap: {
    width: 28,
    alignItems: "center"
  },
  rowBody: {
    flex: 1,
    gap: 4
  },
  rowTitle: {
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "600"
  },
  rowSubtitle: {
    color: APP_TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18
  },
  connectBtn: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: APP_SURFACE,
    borderWidth: 1,
    borderColor: "#4a4a4a",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  connectBtnActive: {
    borderColor: APP_LIME
  },
  connectBtnText: {
    color: APP_LIME,
    fontSize: 13,
    fontWeight: "700"
  },
  connectBtnTextActive: {
    color: APP_LIME
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3a3a3a",
    marginLeft: 14
  }
});
