import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import { appRoleToApiRole } from "../../onboarding/roleMap";
import type { AppRole } from "../../onboarding/types";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { onboardingTheme } from "../../onboarding/OnboardingLayout";

const { BORDER, GREEN } = onboardingTheme;

const ROLES: { id: AppRole; title: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "buyer", title: "Buyer", desc: "Shop produce, machinery, and services", icon: "basket-outline" },
  { id: "seller", title: "Seller", desc: "List from your farm and manage orders", icon: "storefront-outline" },
  { id: "expert", title: "Expert", desc: "Teach courses and advise the community", icon: "school-outline" }
];

export function RoleSelectionScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { updateUser } = useAuth();
  const { setAppRole } = useOnboarding();

  const pick = async (role: AppRole) => {
    await updateUser({ role: appRoleToApiRole(role) });
    await setAppRole(role);
    if (role === "buyer") navigation.navigate("BuyerInterests");
    else if (role === "seller") navigation.navigate("SellerFarm");
    else navigation.navigate("ExpertDomain");
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>How will you use Agrovibes?</Text>
      <Text style={styles.sub}>Pick one — you can explore other areas anytime.</Text>
      <View style={styles.list}>
        {ROLES.map((r) => (
          <Pressable key={r.id} onPress={() => pick(r.id)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
            <View style={styles.iconWrap}>
              <Ionicons name={r.icon} size={26} color={GREEN} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{r.title}</Text>
              <Text style={styles.cardDesc}>{r.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9aa9a5" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f5f4", paddingHorizontal: 16, paddingTop: 48 },
  title: { fontSize: 22, fontWeight: "900", color: "#111616" },
  sub: { marginTop: 8, fontWeight: "600", color: "#5b6966", fontSize: 14, lineHeight: 20 },
  list: { marginTop: 22, gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 14
  },
  cardPressed: { opacity: 0.92 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#eef8f1",
    alignItems: "center",
    justifyContent: "center"
  },
  cardText: { flex: 1 },
  cardTitle: { fontWeight: "900", fontSize: 16, color: "#22312d" },
  cardDesc: { marginTop: 4, fontWeight: "600", color: "#6b7874", fontSize: 12, lineHeight: 16 }
});
