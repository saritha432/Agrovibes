import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { markLaunchSetupComplete, setLaunchLanguage } from "../../onboarding/launchSetup";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { useLanguage, type AppLanguage, SUPPORTED_LANGUAGES } from "../../localization/LanguageContext";
import { APP_LIME } from "../../theme/appColors";

const GREEN = APP_LIME;
const BG = "#262626";
const BORDER = "#3a424c";
/** Full list shown in onboarding; app UI uses i18n for all supported languages. */
const LANGUAGES = ["English", "Hindi", "Telugu", "Kannada", "Malayalam", "Tamil", "Marathi", "Bengali"];

function toAppLanguage(selected: string): AppLanguage {
  return SUPPORTED_LANGUAGES.includes(selected as AppLanguage) ? (selected as AppLanguage) : "English";
}

export function ChooseLanguageScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, updateUser } = useAuth();
  const { t, setLanguage, language } = useLanguage();
  const [selected, setSelected] = React.useState(language || "English");

  const finish = async () => {
    const appLang = toAppLanguage(selected);
    await setLanguage(appLang);
    if (user?.id != null) {
      await setLaunchLanguage(user.id, selected);
      await markLaunchSetupComplete(user.id);
    }
    await updateUser({ preferredLanguage: selected });
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t("chooseLanguageTitle")}</Text>
      <Text style={styles.subtitle}>{t("chooseLanguageSub")}</Text>
      <View style={styles.list}>
        {LANGUAGES.map((item) => (
          <Pressable
            key={item}
            style={[styles.item, selected === item ? styles.itemSelected : null]}
            onPress={() => setSelected(item)}
          >
            <Text style={[styles.itemText, selected === item ? styles.itemTextSelected : null]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.primaryBtn} onPress={finish}>
        <Text style={styles.primaryText}>{t("selectLanguage")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 18 },
  title: { color: GREEN, fontWeight: "900", fontSize: 24, lineHeight: 28 },
  subtitle: { marginTop: 10, color: "#9ca8b1", fontWeight: "600", fontSize: 12, lineHeight: 18 },
  list: { marginTop: 18, gap: 8 },
  item: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#252a30" },
  itemSelected: { borderColor: GREEN, backgroundColor: "#2f3818" },
  itemText: { color: "#d7dee3", fontWeight: "700", fontSize: 13 },
  itemTextSelected: { color: GREEN },
  primaryBtn: {
    marginTop: "auto",
    backgroundColor: GREEN,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  primaryText: { color: "#1b1f23", fontWeight: "900", fontSize: 13 }
});
