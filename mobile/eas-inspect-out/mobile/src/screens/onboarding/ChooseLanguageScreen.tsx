import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { markLaunchSetupComplete, setLaunchLanguage } from "../../onboarding/launchSetup";
import type { RootStackParamList } from "../../navigation/RootNavigator";

const GREEN = "#b9f530";
const BG = "#1d2126";
const BORDER = "#3a424c";
const LANGUAGES = ["English", "Hindi", "Telugu", "Punjabi", "Gujarati", "Bengali", "Marathi", "Tamil"];

export function ChooseLanguageScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, updateUser } = useAuth();
  const [selected, setSelected] = React.useState("English");

  const finish = async () => {
    if (user?.id != null) {
      await setLaunchLanguage(user.id, selected);
      await markLaunchSetupComplete(user.id);
    }
    await updateUser({ preferredLanguage: selected });
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Choose{"\n"}Your Language</Text>
      <Text style={styles.subtitle}>Select your preferred language to personalize your app experience.</Text>
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
        <Text style={styles.primaryText}>Select Language</Text>
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
