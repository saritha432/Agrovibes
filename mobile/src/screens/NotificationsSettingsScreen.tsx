import React, { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { useAuth } from "../auth/AuthContext";
import {
  fetchPushSettings,
  updatePushSettings,
  type PushNotificationSettings
} from "../services/api";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

const CARD = "#303132";
const DIVIDER = "rgba(255,255,255,0.1)";
const DEFAULT_SETTINGS: PushNotificationSettings = {
  pushEnabled: true,
  messagesEnabled: true,
  activityEnabled: true,
  sleepMode: false,
  pauseAii: false,
  followingAndFollowers: true,
  liveAndDrops: true
};

function normalizeSettings(
  incoming: Partial<PushNotificationSettings> | null | undefined,
  base?: PushNotificationSettings
): PushNotificationSettings {
  return {
    ...(base ?? DEFAULT_SETTINGS),
    ...(incoming ?? {})
  };
}

export function NotificationsSettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token } = useAuth();
  const [settings, setSettings] = useState<PushNotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const load = async () => {
        if (!token) return;
        setLoading(true);
        try {
          const next = await fetchPushSettings(token);
          if (!mounted) return;
          setSettings((prev) => normalizeSettings(next, prev));
        } finally {
          if (mounted) setLoading(false);
        }
      };
      void load();
      return () => {
        mounted = false;
      };
    }, [token])
  );

  const persist = useCallback(
    async (next: PushNotificationSettings) => {
      setSettings(next);
      if (!token) return;
      setSaving(true);
      try {
        const saved = await updatePushSettings(token, next);
        setSettings((prev) => normalizeSettings(saved, prev));
      } finally {
        setSaving(false);
      }
    },
    [token]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={APP_LIME} />
        </Pressable>
        <Text style={styles.topTitle}>Notifications</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Push Notifications</Text>
          <SettingsToggleRow
            title="Pause All"
            subtitle="Temporarily Pause Notifications"
            value={!settings.pushEnabled}
            onValueChange={(pauseAll) =>
              void persist({
                ...settings,
                pushEnabled: !pauseAll
              })
            }
            disabled={loading || saving}
          />
          <View style={styles.divider} />
          <SettingsToggleRow
            title="Sleep Mode"
            subtitle="Automatically mute notifications at night or whenever you need to focus."
            value={settings.sleepMode}
            onValueChange={(sleepMode) => void persist({ ...settings, sleepMode })}
            disabled={loading || saving}
          />
          <View style={styles.divider} />
          <SettingsToggleRow
            title="Pause AII"
            subtitle="Only receive notifications about new messages and other message notifications, such as requests and reminders."
            value={settings.pauseAii}
            onValueChange={(pauseAii) => void persist({ ...settings, pauseAii })}
            disabled={loading || saving}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Notification Categories</Text>
          <SettingsToggleRow
            title="Posts, Stories And Comments"
            subtitle=""
            value={settings.activityEnabled}
            onValueChange={(activityEnabled) => void persist({ ...settings, activityEnabled })}
            disabled={loading || saving}
          />
          <View style={styles.divider} />
          <SettingsToggleRow
            title="Following And Followers"
            subtitle=""
            value={settings.followingAndFollowers}
            onValueChange={(followingAndFollowers) => void persist({ ...settings, followingAndFollowers })}
            disabled={loading || saving}
          />
          <View style={styles.divider} />
          <SettingsToggleRow
            title="Messages & Calls"
            subtitle=""
            value={settings.messagesEnabled}
            onValueChange={(messagesEnabled) => void persist({ ...settings, messagesEnabled })}
            disabled={loading || saving}
          />
          <View style={styles.divider} />
          <SettingsToggleRow
            title="Live And Drops"
            subtitle=""
            value={settings.liveAndDrops}
            onValueChange={(liveAndDrops) => void persist({ ...settings, liveAndDrops })}
            disabled={loading || saving}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  disabled
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#5a5a5a", true: "rgba(201,255,53,0.55)" }}
        thumbColor={value ? APP_LIME : "#e5e7eb"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: APP_BLACK
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    color: APP_TEXT,
    fontSize: 16,
    fontWeight: "600"
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 12
  },
  card: {
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: DIVIDER,
    overflow: "hidden"
  },
  row: {
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  rowBody: {
    flex: 1,
    gap: 4,
    paddingRight: 8
  },
  rowTitle: {
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "600"
  },
  rowSubtitle: {
    color: APP_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 17
  },
  cardHeading: {
    color: APP_TEXT_MUTED,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 2
  },
  divider: {
    height: 1,
    backgroundColor: DIVIDER
  }
});
