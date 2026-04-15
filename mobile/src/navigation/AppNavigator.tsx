import React, { useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, View } from "react-native";
import { CreateModal } from "../components/CreateModal";
import { CommunityScreen } from "../screens/CommunityScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { MarketplaceScreen } from "../screens/MarketplaceScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ServicesScreen } from "../screens/ServicesScreen";

const Tab = createBottomTabNavigator();

function EmptyCreateScreen() {
  return <View style={styles.screen} />;
}

export function AppNavigator() {
  const [isCreateOpen, setCreateOpen] = useState(false);
  return (
    <View style={styles.root}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#0f9d46",
          tabBarStyle: { height: 62, paddingBottom: 6, paddingTop: 6 }
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Market" component={MarketplaceScreen} />
        <Tab.Screen
          name="Create"
          component={EmptyCreateScreen}
          listeners={{
            tabPress: (event) => {
              event.preventDefault();
              setCreateOpen(true);
            }
          }}
          options={{
            tabBarLabel: "",
            tabBarIcon: () => <View style={styles.centerPlus}><Text style={styles.centerPlusText}>＋</Text></View>
          }}
        />
        <Tab.Screen name="Services" component={ServicesScreen} />
        <Tab.Screen name="Community" component={CommunityScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
      <CreateModal visible={isCreateOpen} onClose={() => setCreateOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f5f4" },
  screen: { flex: 1, backgroundColor: "#f2f5f4" },
  centerPlus: {
    marginTop: -6,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#0a9f46",
    alignItems: "center",
    justifyContent: "center"
  },
  centerPlusText: { color: "#fff", fontSize: 28, fontWeight: "700", marginTop: -1 }
});
