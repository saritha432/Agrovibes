import React, { useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, View } from "react-native";
import { CreateModal } from "../components/CreateModal";
import { CommunityScreen } from "../screens/CommunityScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { MarketplaceScreen } from "../screens/MarketplaceScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { MainTabBar } from "./MainTabBar";
import type { CreateType } from "../components/CreateModal";

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [homeRefreshToken, setHomeRefreshToken] = useState(0);
  const [createPresetType, setCreatePresetType] = useState<CreateType | null>(null);

  return (
    <View style={styles.root}>
      <Tab.Navigator
        screenOptions={{ headerShown: false, tabBarShowLabel: false }}
        tabBar={(props) => (
          <MainTabBar
            {...props}
            onCreatePress={() => {
              setCreatePresetType(null);
              setCreateOpen(true);
            }}
          />
        )}
      >
        <Tab.Screen
          name="Home"
          children={() => (
            <HomeScreen
              refreshToken={homeRefreshToken}
              onOpenCreate={() => {
                setCreatePresetType(null);
                setCreateOpen(true);
              }}
            />
          )}
        />
        <Tab.Screen name="Marketplace" component={MarketplaceScreen} />
        <Tab.Screen name="Learn" component={CommunityScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
      <CreateModal
        visible={isCreateOpen}
        initialType={createPresetType}
        onClose={() => {
          setCreatePresetType(null);
          setCreateOpen(false);
        }}
        onVideoPosted={() => setHomeRefreshToken((v) => v + 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f5f4" }
});
