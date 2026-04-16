import React, { useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, View } from "react-native";
import { CreateModal } from "../components/CreateModal";
import { CommunityScreen } from "../screens/CommunityScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { MarketplaceScreen } from "../screens/MarketplaceScreen";
import { ServicesScreen } from "../screens/ServicesScreen";
import { MainTabBar } from "./MainTabBar";

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  const [isCreateOpen, setCreateOpen] = useState(false);
  return (
    <View style={styles.root}>
      <Tab.Navigator
        screenOptions={{ headerShown: false, tabBarShowLabel: false }}
        tabBar={(props) => <MainTabBar {...props} onCreatePress={() => setCreateOpen(true)} />}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Marketplace" component={MarketplaceScreen} />
        <Tab.Screen name="Services" component={ServicesScreen} />
        <Tab.Screen name="Community" component={CommunityScreen} />
      </Tab.Navigator>
      <CreateModal visible={isCreateOpen} onClose={() => setCreateOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f5f4" }
});
