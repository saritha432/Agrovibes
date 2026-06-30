import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterCard, AccountCenterSubLayout } from "../components/accountCenter/AccountCenterSubLayout";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import {
  readSearchHistorySettings,
  setAutoClearPeriod,
  type AutoClearPeriod
} from "../utils/searchHistorySettings";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

const OPTIONS: Array<{ value: AutoClearPeriod; label: string; hint?: string }> = [
  { value: 3, label: "3 days" },
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  {
    value: "default",
    label: "Default",
    hint: "Cropvibe keeps searches for the past year. Linked apps like Instagram may use shorter periods such as 30 days."
  }
];

function RadioOption({
  label,
  hint,
  selected,
  onPress,
  showDivider
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  showDivider?: boolean;
}) {
  return (
    <>
      <Pressable style={styles.optionRow} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}>
        <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
          {selected ? <View style={styles.radioInner} /> : null}
        </View>
        <View style={styles.optionBody}>
          <Text style={styles.optionLabel}>{label}</Text>
          {hint ? <Text style={styles.optionHint}>{hint}</Text> : null}
        </View>
      </Pressable>
      {showDivider ? <View style={styles.divider} /> : null}
    </>
  );
}

export function AutoClearSearchHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selected, setSelected] = useState<AutoClearPeriod>("default");

  const load = useCallback(async () => {
    const settings = await readSearchHistorySettings();
    setSelected(settings.autoClearPeriod);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const choose = async (period: AutoClearPeriod) => {
    setSelected(period);
    await setAutoClearPeriod(period);
  };

  const showHowItWorks = () => {
    navigation.navigate("HowAutoClearingWorks");
  };

  return (
    <AccountCenterSubLayout
      title="Auto Clear Search History"
      description={
        <Text style={styles.description}>
          Searches that are older than the timeframe you select will be automatically cleared from your account.
        </Text>
      }
      contentStyle={styles.content}
    >
      <AccountCenterCard>
        {OPTIONS.map((option, index) => (
          <RadioOption
            key={String(option.value)}
            label={option.label}
            hint={option.hint}
            selected={selected === option.value}
            onPress={() => void choose(option.value)}
            showDivider={index < OPTIONS.length - 1}
          />
        ))}
      </AccountCenterCard>

      <AccountCenterCard>
        <Pressable style={styles.helpRow} onPress={showHowItWorks} accessibilityRole="button">
          <Ionicons name="information-circle-outline" size={22} color={APP_LIME} />
          <Text style={styles.helpTitle}>How Auto Clearing Works</Text>
          <Ionicons name="chevron-forward" size={18} color={APP_TEXT_MUTED} />
        </Pressable>
      </AccountCenterCard>
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  description: {
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 21
  },
  content: {
    paddingBottom: 40
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  radioOuterSelected: {
    borderColor: APP_LIME
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: APP_LIME
  },
  optionBody: {
    flex: 1,
    gap: 6
  },
  optionLabel: {
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "600"
  },
  optionHint: {
    color: APP_TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3a3a3a",
    marginLeft: 14
  },
  helpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  helpTitle: {
    flex: 1,
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "600"
  }
});
