import React, { useCallback, useRef, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, View } from "react-native";
import { CreateModal } from "../components/CreateModal";
import { HomeScreen } from "../screens/HomeScreen";
import type { HomePost } from "../services/api";
import { MarketStackNavigator } from "./MarketStackNavigator";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ServicesScreen } from "../screens/ServicesScreen";
import { MainTabBar } from "./MainTabBar";
import type { CreateType } from "../components/CreateModal";
import type { OpenCreateOptions } from "../screens/HomeScreen";
import { LearnStackNavigator } from "./LearnStackNavigator";
import { NotificationPanelProvider } from "../context/NotificationPanelContext";

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [homeRefreshToken, setHomeRefreshToken] = useState(0);
  const [createPresetType, setCreatePresetType] = useState<CreateType | null>(null);
  const [createLiveOptions, setCreateLiveOptions] = useState<OpenCreateOptions | null>(null);
  /** Newly created post from API — consumed on the next Home feed fetch so it appears immediately even if GET is briefly stale. */
  const pendingFeedPostRef = useRef<HomePost | undefined>(undefined);
  const takePendingFeedPost = useCallback(() => {
    const next = pendingFeedPostRef.current;
    pendingFeedPostRef.current = undefined;
    return next;
  }, []);

  return (
    <NotificationPanelProvider>
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
              takePendingFeedPost={takePendingFeedPost}
              onOpenCreate={(type, options) => {
                setCreatePresetType(type ?? null);
                setCreateLiveOptions(options ?? null);
                setCreateOpen(true);
              }}
            />
          )}
        />
        <Tab.Screen name="Market" component={MarketStackNavigator} />
        <Tab.Screen name="Learn" component={LearnStackNavigator} />
        <Tab.Screen name="Services" component={ServicesScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
      {isCreateOpen ? (
        <CreateModal
          visible
          initialType={createPresetType}
          initialLiveTopic={createLiveOptions?.liveTopic}
          scheduledLiveId={createLiveOptions?.scheduledLiveId}
          autoStartLive={!!createLiveOptions?.autoStartLive}
          onClose={() => {
            setCreatePresetType(null);
            setCreateLiveOptions(null);
            setCreateOpen(false);
          }}
          onVideoPosted={(post) => {
            if (post) pendingFeedPostRef.current = post;
            setHomeRefreshToken((v) => v + 1);
          }}
        />
      ) : null}
    </View>
    </NotificationPanelProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#262626" }
});
