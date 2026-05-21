import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../localization/LanguageContext";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { APP_LIME } from "../../theme/appColors";

const GREEN = APP_LIME;
const BG = "#262626";
const CARD = "#252a30";
const BORDER = "#3a424c";

export function FirstTimeRoleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { updateUser } = useAuth();
  const { t } = useLanguage();
  const [selected, setSelected] = React.useState<"farmer" | "consumer" | "educator" | "logistics">("farmer");

  const ROLES = [
    { key: "farmer" as const, title: t("firstTimeRoleFarmer"), subtitle: t("firstTimeRoleFarmerSub") },
    { key: "consumer" as const, title: t("firstTimeRoleConsumer"), subtitle: t("firstTimeRoleConsumerSub") },
    { key: "educator" as const, title: t("firstTimeRoleEducator"), subtitle: t("firstTimeRoleEducatorSub") },
    { key: "logistics" as const, title: t("firstTimeRoleLogistics"), subtitle: t("firstTimeRoleLogisticsSub") }
  ];

  const next = async () => {
    await updateUser({ role: selected === "educator" ? "instructor" : "student" });
    navigation.navigate("FirstTimeCrops");
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t("firstTimeRoleTitle")}</Text>
      <Text style={styles.subtitle}>{t("firstTimeRoleSubtitle")}</Text>
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
        <Text style={styles.primaryText}>{t("continue")}</Text>
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
