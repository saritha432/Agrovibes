import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { markLaunchSetupComplete } from "../../onboarding/launchSetup";
import type { RootStackParamList } from "../../navigation/RootNavigator";

const GREEN = "#b9f530";
const BG = "#1d2126";
const CARD = "#252a30";
const BORDER = "#3a424c";

const GROUPS = [
  { title: "GRAINS & CEREALS", items: ["Rice", "Wheat", "Jowar", "Maize", "Bajra"] },
  { title: "VEGETABLES", items: ["Tomato", "Potato", "Onion", "Chilli", "Brinjal"] },
  { title: "FRUITS", items: ["Mango", "Banana", "Grapes", "Orange", "Apple"] },
  { title: "PULSES", items: ["Tur", "Moong", "Urad", "Masoor", "Chana"] }
] as const;

export function FirstTimeCropsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, updateUser } = useAuth();
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>(["Rice"]);

  const toggle = (value: string) => {
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const finish = async () => {
    await updateUser({ locationLabel: selected.join(", ") });
    if (user?.id != null) {
      await markLaunchSetupComplete(user.id);
    }
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>What do you grow?</Text>
      <Text style={styles.subtitle}>Tell us what crops you grow to receive relevant recommendations.</Text>

      <TextInput
        style={styles.search}
        placeholder="Search by crop"
        placeholderTextColor="#7f8b93"
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {GROUPS.map((group) => {
          const items = group.items.filter((item) => item.toLowerCase().includes(search.trim().toLowerCase()));
          if (items.length === 0) return null;
          return (
            <View key={group.title} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={styles.chips}>
                {items.map((item) => {
                  const isSelected = selected.includes(item);
                  return (
                    <Pressable key={item} onPress={() => toggle(item)} style={[styles.chip, isSelected ? styles.chipSelected : null]}>
                      <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>{item}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Pressable style={[styles.primaryBtn, selected.length === 0 ? styles.disabledBtn : null]} onPress={finish} disabled={selected.length === 0}>
        <Text style={styles.primaryText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 18 },
  title: { color: GREEN, fontWeight: "900", fontSize: 24, lineHeight: 28 },
  subtitle: { marginTop: 8, color: "#9ca8b1", fontWeight: "600", fontSize: 12, lineHeight: 18 },
  search: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: CARD,
    color: "#e6edf2",
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  scroll: { marginTop: 10 },
  scrollContent: { paddingBottom: 12 },
  group: { marginBottom: 14 },
  groupTitle: { color: "#93a1aa", fontSize: 10, fontWeight: "800", marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipSelected: { borderColor: GREEN, backgroundColor: "#2f3818" },
  chipText: { color: "#d7dee3", fontWeight: "700", fontSize: 11 },
  chipTextSelected: { color: GREEN },
  primaryBtn: { marginTop: "auto", backgroundColor: GREEN, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  disabledBtn: { opacity: 0.6 },
  primaryText: { color: "#1b1f23", fontWeight: "900", fontSize: 13 }
});
