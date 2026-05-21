import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../localization/LanguageContext";
import { markLaunchSetupComplete } from "../../onboarding/launchSetup";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { APP_LIME } from "../../theme/appColors";

const GREEN = APP_LIME;
const BG = "#262626";
const CARD = "#252a30";
const BORDER = "#3a424c";

const GROUPS = [
  {
    titleKey: "cropGroupGrains",
    items: [
      { id: "Rice", labelKey: "cropRice" },
      { id: "Wheat", labelKey: "cropWheat" },
      { id: "Jowar", labelKey: "cropJowar" },
      { id: "Maize", labelKey: "cropMaize" },
      { id: "Bajra", labelKey: "cropBajra" }
    ]
  },
  {
    titleKey: "cropGroupVegetables",
    items: [
      { id: "Tomato", labelKey: "cropTomato" },
      { id: "Potato", labelKey: "cropPotato" },
      { id: "Onion", labelKey: "cropOnion" },
      { id: "Chilli", labelKey: "cropChilli" },
      { id: "Brinjal", labelKey: "cropBrinjal" }
    ]
  },
  {
    titleKey: "cropGroupFruits",
    items: [
      { id: "Mango", labelKey: "cropMango" },
      { id: "Banana", labelKey: "cropBanana" },
      { id: "Grapes", labelKey: "cropGrapes" },
      { id: "Orange", labelKey: "cropOrange" },
      { id: "Apple", labelKey: "cropApple" }
    ]
  },
  {
    titleKey: "cropGroupPulses",
    items: [
      { id: "Tur", labelKey: "cropTur" },
      { id: "Moong", labelKey: "cropMoong" },
      { id: "Urad", labelKey: "cropUrad" },
      { id: "Masoor", labelKey: "cropMasoor" },
      { id: "Chana", labelKey: "cropChana" }
    ]
  }
] as const;

export function FirstTimeCropsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, updateUser } = useAuth();
  const { t } = useLanguage();
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

  const query = search.trim().toLowerCase();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t("firstTimeCropsTitle")}</Text>
      <Text style={styles.subtitle}>{t("firstTimeCropsSubtitle")}</Text>

      <TextInput
        style={styles.search}
        placeholder={t("searchByCrop")}
        placeholderTextColor="#7f8b93"
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {GROUPS.map((group) => {
          const items = group.items.filter(
            (item) =>
              !query || item.id.toLowerCase().includes(query) || t(item.labelKey).toLowerCase().includes(query)
          );
          if (items.length === 0) return null;
          return (
            <View key={group.titleKey} style={styles.group}>
              <Text style={styles.groupTitle}>{t(group.titleKey)}</Text>
              <View style={styles.chips}>
                {items.map((item) => {
                  const isSelected = selected.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => toggle(item.id)}
                      style={[styles.chip, isSelected ? styles.chipSelected : null]}
                    >
                      <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>{t(item.labelKey)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Pressable style={[styles.primaryBtn, selected.length === 0 ? styles.disabledBtn : null]} onPress={finish} disabled={selected.length === 0}>
        <Text style={styles.primaryText}>{t("continue")}</Text>
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
