import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PasswordSecurityContent } from "../components/accountCenter/PasswordSecurityContent";
import { SheetNavContext } from "../components/accountCenter/accountCenterSheetNav";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_BLACK } from "../theme/appColors";

export function PasswordSecurityScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const navValue = useMemo(
    () => ({
      push: () => {},
      pop: () => navigation.goBack(),
      close: () => navigation.goBack(),
      navigateStack: (screen: keyof RootStackParamList) => {
        navigation.goBack();
        requestAnimationFrame(() => navigation.navigate(screen as any));
      }
    }),
    [navigation]
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => navigation.goBack()}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12), maxHeight: "92%" }]}>
          <View style={styles.handle} />
          <View style={styles.sheetBody}>
            <SheetNavContext.Provider value={navValue}>
              <PasswordSecurityContent />
            </SheetNavContext.Provider>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0, 0, 0, 0.55)" },
  sheet: {
    backgroundColor: APP_BLACK,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden"
  },
  sheetBody: { flexShrink: 1 },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    marginTop: 10,
    marginBottom: 4
  }
});
