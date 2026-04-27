import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";

const GREEN = "#b9f530";
const BG = "#1d2126";
const CARD = "#252a30";
const BORDER = "#3a424c";

const ROLES = [
  { key: "farmer", title: "Farmer", subtitle: "I cultivate crops and sell my produce." },
  { key: "consumer", title: "Consumer", subtitle: "I buy produce for home and business use." },
  { key: "educator", title: "Educator", subtitle: "I share knowledge, tools and best practices." },
  { key: "logistics", title: "Logistics", subtitle: "I help move farm produce and inputs." }
] as const;

export function FirstTimeRoleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { updateUser } = useAuth();
  const [selected, setSelected] = React.useState<(typeof ROLES)[number]["key"]>("farmer");

  const next = async () => {
    await updateUser({ role: selected === "educator" ? "instructor" : "student" });
    navigation.navigate("FirstTimeCrops");
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>What do you do?</Text>
      <Text style={styles.subtitle}>Select your role within the app.</Text>
      <View style={styles.list}>
        {ROLES.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.item, selected === item.key ? styles.itemSelected : null]}
            onPress={() => setSelected(item.key)}
          >
            <Text style={[styles.itemTitle, selected === item.key ? styles.itemTitleSelected : null]}>{item.title}</Text>
            <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.primaryBtn} onPress={next}>
        <Text style={styles.primaryText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 18 },
  title: { color: GREEN, fontWeight: "900", fontSize: 24, lineHeight: 28 },
  subtitle: { marginTop: 8, color: "#9ca8b1", fontWeight: "600", fontSize: 12 },
  list: { marginTop: 14, gap: 10 },
  item: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  itemSelected: { borderColor: GREEN, backgroundColor: "#2f3818" },
  itemTitle: { color: "#e6edf2", fontWeight: "900", fontSize: 14 },
  itemTitleSelected: { color: GREEN },
  itemSubtitle: { marginTop: 4, color: "#9da9b2", fontWeight: "600", fontSize: 11, lineHeight: 15 },
  primaryBtn: { marginTop: "auto", backgroundColor: GREEN, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  primaryText: { color: "#1b1f23", fontWeight: "900", fontSize: 13 }
});
