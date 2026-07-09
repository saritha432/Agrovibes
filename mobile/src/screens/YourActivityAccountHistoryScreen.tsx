import React, { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_BLACK, APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";
import { useAuth } from "../auth/AuthContext";
import { fetchMyAccount } from "../services/api";

const DIVIDER = "rgba(255,255,255,0.08)";
const CHIP_BG = "#2e3237";

type Entry = { key: string; title: string; subtitle: string; age: string; icon: keyof typeof Ionicons.glyphMap };

function ageLabel(iso?: string | null) {
  const ms = Date.parse(String(iso || ""));
  if (!Number.isFinite(ms)) return "";
  const diffDays = Math.max(1, Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000)));
  if (diffDays < 30) return `${diffDays}d`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
  return `${Math.floor(diffDays / 365)}y`;
}

function fullDate(iso?: string | null) {
  const d = new Date(String(iso || ""));
  if (!Number.isFinite(d.getTime())) return "Unknown";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "2-digit" });
}

export function YourActivityAccountHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const data = await fetchMyAccount(token);
        if (!mounted) return;
        setCreatedAt(data.createdAt || null);
        setPasswordUpdatedAt(data.passwordUpdatedAt || null);
      } catch {
        if (!mounted) return;
        setCreatedAt(null);
        setPasswordUpdatedAt(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [token]);

  const entries = useMemo<Entry[]>(
    () => [
      {
        key: "password",
        title: "Password",
        subtitle: passwordUpdatedAt ? `Password updated on ${fullDate(passwordUpdatedAt)}` : "Password update information not available",
        age: ageLabel(passwordUpdatedAt),
        icon: "key-outline"
      },
      {
        key: "username",
        title: "Username",
        subtitle: user?.username ? `Current username is ${user.username}.` : "Username is not set on this account.",
        age: "",
        icon: "at-outline"
      },
      {
        key: "account-status",
        title: "Account status",
        subtitle: `Your account is ${String(user?.accountStatus || "active")}.`,
        age: "",
        icon: "shield-checkmark-outline"
      },
      {
        key: "created",
        title: "Account created",
        subtitle: createdAt ? `You created your profile on ${fullDate(createdAt)}` : "Account creation date not available",
        age: ageLabel(createdAt),
        icon: "information-circle-outline"
      }
    ],
    [createdAt, passwordUpdatedAt, user?.accountStatus, user?.username]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={22} color={APP_LIME} /></Pressable>
        <Text style={styles.topTitle}>Account history</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersBarContent} style={styles.filtersBar}>
        <FilterChip label="Newest to oldest" />
        <FilterChip label="All dates" />
        <FilterChip label="Update type" />
      </ScrollView>

      <ScrollView style={{ flex: 1 }}>
        <View style={styles.aboutWrap}>
          <Text style={styles.aboutTitle}>About account history</Text>
          <Text style={styles.aboutSub}>Review changes you've made to your account since you created it.</Text>
        </View>
        {loading ? <ActivityIndicator color={APP_LIME} style={{ marginTop: 14 }} /> : null}
        <View style={styles.list}>
          {entries.map((item) => (
            <Pressable key={item.key} style={styles.row}>
              <Ionicons name={item.icon} size={20} color={APP_TEXT} style={{ marginTop: 2 }} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowSub}>{item.subtitle}</Text>
                {item.age ? <Text style={styles.rowAge}>{item.age}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <View style={styles.filterChip}>
      <Text style={styles.filterChipText}>{label}</Text>
      <Ionicons name="chevron-down" size={14} color={APP_TEXT_MUTED} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_BLACK },
  topBar: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: DIVIDER },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { color: APP_LIME, fontSize: 18, fontWeight: "700" },
  filtersBar: { borderBottomWidth: 1, borderBottomColor: DIVIDER, height: 54, maxHeight: 54 },
  filtersBarContent: { gap: 8, paddingHorizontal: 8, paddingVertical: 10, alignItems: "center" },
  filterChip: { minWidth: 110, minHeight: 30, borderRadius: 6, backgroundColor: CHIP_BG, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  filterChipText: { color: APP_TEXT, fontSize: 12, fontWeight: "600" },
  aboutWrap: { paddingHorizontal: 16, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: DIVIDER },
  aboutTitle: { color: APP_LIME, fontSize: 34 / 2, fontWeight: "700", textAlign: "center" },
  aboutSub: { color: APP_TEXT_MUTED, fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 18 },
  list: { paddingTop: 6 },
  row: { minHeight: 72, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: DIVIDER, flexDirection: "row", alignItems: "center", gap: 12 },
  rowBody: { flex: 1 },
  rowTitle: { color: APP_LIME, fontSize: 18 / 1.3, fontWeight: "600" },
  rowSub: { color: APP_TEXT_MUTED, fontSize: 12, marginTop: 1, lineHeight: 16 },
  rowAge: { color: APP_TEXT_MUTED, fontSize: 12, marginTop: 2 }
});
