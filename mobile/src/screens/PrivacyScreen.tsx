import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../localization/LanguageContext";
import { fetchMyAccount, updateMyPrivacySettings } from "../services/api";
import { APP_BLACK, APP_LIME, APP_SURFACE } from "../theme/appColors";

const BG = APP_BLACK;
const LIME = APP_LIME;
const CARD = APP_SURFACE;
const TEXT = "#f0f4f8";
const MUTED = "#97a0a8";

export function PrivacyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { t } = useLanguage();
  const { token, user, updateUser } = useAuth();

  const [privateAccount, setPrivateAccount] = useState(Boolean(user?.isPrivate));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // const [showActivityStatus, setShowActivityStatus] = useState(true);
  // const [showReadReceipts, setShowReadReceipts] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const load = async () => {
        if (!token) return;
        setLoading(true);
        try {
          const data = await fetchMyAccount(token);
          if (!mounted) return;
          const next = Boolean(data?.user?.isPrivate);
          setPrivateAccount(next);
          await updateUser({ isPrivate: next });
        } catch {
          if (mounted) setPrivateAccount(Boolean(user?.isPrivate));
        } finally {
          if (mounted) setLoading(false);
        }
      };
      void load();
      return () => {
        mounted = false;
      };
    }, [token, updateUser, user?.isPrivate])
  );

  const onTogglePrivate = useCallback(
    async (next: boolean) => {
      setPrivateAccount(next);
      if (!token) return;
      setSaving(true);
      try {
        const data = await updateMyPrivacySettings(token, { isPrivate: next });
        const saved = Boolean(data?.user?.isPrivate);
        setPrivateAccount(saved);
        await updateUser({ isPrivate: saved });
      } catch {
        setPrivateAccount(!next);
      } finally {
        setSaving(false);
      }
    },
    [token, updateUser]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={styles.topTitle}>{t("privacy") || "Privacy"}</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Private Account</Text>
              <Text style={styles.rowSub}>
                Only approved followers can see your posts, reels, and stories
              </Text>
            </View>
            {loading ? (
              <ActivityIndicator color={LIME} />
            ) : (
              <Switch
                value={privateAccount}
                onValueChange={(next) => void onTogglePrivate(next)}
                disabled={saving}
                trackColor={{ false: "#3a3a3a", true: LIME }}
                thumbColor="#fff"
              />
            )}
          </View>

          {/* <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Activity Status</Text>
              <Text style={styles.rowSub}>Show when you were last active</Text>
            </View>
            <Switch
              value={showActivityStatus}
              onValueChange={setShowActivityStatus}
              trackColor={{ false: "#3a3a3a", true: LIME }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Read Receipts</Text>
              <Text style={styles.rowSub}>Let others know when you've seen their messages</Text>
            </View>
            <Switch
              value={showReadReceipts}
              onValueChange={setShowReadReceipts}
              trackColor={{ false: "#3a3a3a", true: LIME }}
              thumbColor="#fff"
            />
          </View> */}
        </View>

        {/* <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interactions</Text>
          <Pressable style={styles.menuItem}>
            <Ionicons name="chatbubble-outline" size={20} color={LIME} />
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemText}>Comments</Text>
              <Text style={styles.menuItemSub}>Control who can comment on your posts</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={MUTED} />
          </Pressable>
          <Pressable style={styles.menuItem}>
            <Ionicons name="at-outline" size={20} color={LIME} />
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemText}>Mentions</Text>
              <Text style={styles.menuItemSub}>Control who can mention you</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={MUTED} />
          </Pressable>
          <Pressable style={styles.menuItem}>
            <Ionicons name="ban-outline" size={20} color={LIME} />
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemText}>Blocked Accounts</Text>
              <Text style={styles.menuItemSub}>Manage accounts you've blocked</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={MUTED} />
          </Pressable>
        </View> */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#262d35"
  },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  topTitle: { color: TEXT, fontSize: 18, fontWeight: "900", textTransform: "capitalize" },
  content: { padding: 16, paddingBottom: 60 },
  section: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#303842",
    padding: 4,
    marginBottom: 16
  },
  // sectionTitle: { color: MUTED, fontSize: 12, fontWeight: "800", paddingHorizontal: 12, paddingTop: 12, marginBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 12
  },
  rowContent: { flex: 1 },
  rowTitle: { color: TEXT, fontSize: 14, fontWeight: "700" },
  rowSub: { color: MUTED, fontSize: 11, fontWeight: "600", marginTop: 2 }
  // menuItem: {
  //   flexDirection: "row",
  //   alignItems: "center",
  //   paddingVertical: 14,
  //   paddingHorizontal: 12,
  //   gap: 12
  // },
  // menuItemContent: { flex: 1 },
  // menuItemText: { color: TEXT, fontSize: 14, fontWeight: "700" },
  // menuItemSub: { color: MUTED, fontSize: 11, fontWeight: "600", marginTop: 2 }
});
