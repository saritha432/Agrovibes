import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/rootStackTypes";
import { APP_BLACK } from "../../theme/appColors";
import { AccountCenterContent, type AccountCenterNavigation } from "./AccountCenterContent";
import { ActivityOffCropvibeContent } from "./ActivityOffCropvibeContent";
import { AutoClearSearchHistoryContent } from "./AutoClearSearchHistoryContent";
import { ChangePasswordContent } from "./ChangePasswordContent";
import { ConnectedExperiencesContent } from "./ConnectedExperiencesContent";
import { HowAutoClearingWorksContent } from "./HowAutoClearingWorksContent";
import { ManageAccountsContent } from "./ManageAccountsContent";
import { ManageAccountOptionsContent } from "./ManageAccountOptionsContent";
import { MemoriesFromCropvibeContent } from "./MemoriesFromCropvibeContent";
import { PasswordSecurityContent } from "./PasswordSecurityContent";
import { ProfilesPersonalDetailsContent } from "./ProfilesPersonalDetailsContent";
import { SearchHistoryContent } from "./SearchHistoryContent";
import { SharingAcrossProfilesContent } from "./SharingAcrossProfilesContent";
import { ShowingProfileLinksContent } from "./ShowingProfileLinksContent";
import { SyncingProfilePicturesContent } from "./SyncingProfilePicturesContent";
import { YourInformationPermissionsContent } from "./YourInformationPermissionsContent";
import { DeactivateDeleteChoiceContent } from "./DeactivateDeleteChoiceContent";
import { DeactivateDeleteContinueContent } from "./DeactivateDeleteContinueContent";
import { resolveAccountCenterSheetRoute } from "./accountCenterSheetRoutes";
import {
  SheetNavContext,
  useAccountCenterSheetNav,
  type AccountCenterSheetRoute,
  type SheetNavContextValue
} from "./accountCenterSheetNav";

type Props = {
  visible: boolean;
  onClose: () => void;
};

function SheetBody({ route }: { route: AccountCenterSheetRoute }) {
  switch (route) {
    case "ProfilesPersonalDetails":
      return <ProfilesPersonalDetailsContent />;
    case "PasswordSecurity":
      return <PasswordSecurityContent />;
    case "ChangePassword":
      return <ChangePasswordContent />;
    case "ConnectedExperiences":
      return <ConnectedExperiencesContent />;
    case "SharingAcrossProfiles":
      return <SharingAcrossProfilesContent />;
    case "SyncingProfilePictures":
      return <SyncingProfilePicturesContent />;
    case "ShowingProfileLinks":
      return <ShowingProfileLinksContent />;
    case "MemoriesFromInstagram":
      return <MemoriesFromCropvibeContent />;
    case "YourInformationPermissions":
      return <YourInformationPermissionsContent />;
    case "SearchHistory":
      return <SearchHistoryContent />;
    case "AutoClearSearchHistory":
      return <AutoClearSearchHistoryContent />;
    case "HowAutoClearingWorks":
      return <HowAutoClearingWorksContent />;
    case "ActivityOffCropvibe":
      return <ActivityOffCropvibeContent />;
    case "ManageAccounts":
      return <ManageAccountsContent />;
    case "ManageAccountOptions":
      return <ManageAccountOptionsContent />;
    case "DeactivateDeleteChoice":
      return <DeactivateDeleteChoiceContent />;
    case "DeactivateDeleteContinue":
      return <DeactivateDeleteContinueContent />;
    case "main":
    default:
      return <AccountCenterMain />;
  }
}

function AccountCenterMain() {
  const { push, close, navigateStack } = useAccountCenterSheetNav();

  return (
    <AccountCenterContent
      onClose={close}
      onNavigate={(screen) => {
        const sheetRoute = resolveAccountCenterSheetRoute(screen);
        if (sheetRoute) {
          push(sheetRoute);
          return;
        }
        close();
        requestAnimationFrame(() => navigateStack(screen));
      }}
    />
  );
}

export function AccountCenterBottomSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AccountCenterNavigation>();
  const [routeStack, setRouteStack] = useState<AccountCenterSheetRoute[]>(["main"]);

  const route = routeStack[routeStack.length - 1] ?? "main";

  useEffect(() => {
    if (!visible) {
      setRouteStack(["main"]);
    }
  }, [visible]);

  const push = useCallback((next: AccountCenterSheetRoute) => {
    setRouteStack((prev) => [...prev, next]);
  }, []);

  const pop = useCallback(() => {
    setRouteStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const close = useCallback(() => {
    setRouteStack(["main"]);
    onClose();
  }, [onClose]);

  const navigateStack = useCallback(
    (screen: keyof RootStackParamList) => {
      navigation.navigate(screen as any);
    },
    [navigation]
  );

  const navValue = useMemo(
    () => ({ push, pop, close, navigateStack }),
    [push, pop, close, navigateStack]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={route === "main" ? close : pop}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={route === "main" ? close : pop}
          accessibilityRole="button"
          accessibilityLabel={route === "main" ? "Close Accounts Centre" : "Back"}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12), maxHeight: "92%" }]}>
          <View style={styles.handle} />
          <View style={styles.sheetBody}>
            <SheetNavContext.Provider value={navValue}>
              <SheetBody route={route} />
            </SheetNavContext.Provider>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end"
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)"
  },
  sheet: {
    backgroundColor: APP_BLACK,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden"
  },
  sheetBody: {
    flexShrink: 1
  },
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
