import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/rootStackTypes";
import { APP_BLACK } from "../../theme/appColors";
import { SheetNavContext, type AccountCenterSheetRoute } from "./accountCenterSheetNav";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function AccountCenterSubBottomSheet({ visible, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const navValue = useMemo(
    () => ({
      push: (_route: AccountCenterSheetRoute) => {},
      pop: onClose,
      close: onClose,
      navigateStack: (screen: keyof RootStackParamList) => {
        onClose();
        requestAnimationFrame(() => navigation.navigate(screen as any));
      }
    }),
    [navigation, onClose]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12), maxHeight: "92%" }]}>
          <View style={styles.handle} />
          <View style={styles.sheetBody}>
            <SheetNavContext.Provider value={navValue}>{children}</SheetNavContext.Provider>
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
