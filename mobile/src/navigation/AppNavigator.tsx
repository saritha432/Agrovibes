import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { HomePost } from "../services/api";
import { HomeScreen } from "../screens/HomeScreen";
import { MainTabBar } from "./MainTabBar";
import type { CreateType } from "../components/CreateModal";
import type { OpenCreateOptions } from "../screens/HomeScreen";
import { NotificationPanelProvider } from "../context/NotificationPanelContext";
import { subscribeOpenLiveCreate } from "./liveCreateBridge";
import { setFeedPlaybackSuspended } from "./feedPlaybackBridge";
import { runPendingNotificationNavigation } from "../push/notificationNavigation";
import { takePersistedReelDeepLink } from "./pendingReelDeepLink";
import { fetchHomePost } from "../services/api";
import { queueOpenSharedPostViewer } from "./sharedPostViewerBridge";
import { useAuth } from "../auth/AuthContext";
import { APP_LIME } from "../theme/appColors";
import { lazyScreen } from "../utils/lazyScreen";

const Tab = createBottomTabNavigator();

/** Heavy create/live UI — lazy on native; sync require on web (Metro HMR-safe). */
const CreateModal = lazyScreen(
  () => import("../components/CreateModal").then((m) => ({ default: m.CreateModal })),
  () => require("../components/CreateModal").CreateModal
);

function CreateModalFallback() {
  return (
    <View style={styles.createFallback} pointerEvents="none">
      <ActivityIndicator color={APP_LIME} size="large" />
    </View>
  );
}

export function AppNavigator() {
  const { token, user } = useAuth();
  const isAccountDeactivated = user?.accountStatus === "deactivated";
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

  React.useEffect(() => {
    return subscribeOpenLiveCreate((payload) => {
      if (user?.accountStatus === "deactivated") return;
      setCreatePresetType("live");
      setCreateLiveOptions({
        liveTopic: payload.liveTopic,
        scheduledLiveId: payload.scheduledLiveId,
        autoStartLive: payload.autoStartLive
      });
      setCreateOpen(true);
    });
  }, [user?.accountStatus]);

  useEffect(() => {
    if (isAccountDeactivated && isCreateOpen) {
      setCreatePresetType(null);
      setCreateLiveOptions(null);
      setCreateOpen(false);
    }
  }, [isAccountDeactivated, isCreateOpen]);

  useEffect(() => {
    setFeedPlaybackSuspended(isCreateOpen);
    return () => setFeedPlaybackSuspended(false);
  }, [isCreateOpen]);

  useEffect(() => {
    runPendingNotificationNavigation();
    void (async () => {
      const postId = await takePersistedReelDeepLink();
      if (!postId) return;
      try {
        const { post } = await fetchHomePost(token ?? null, postId);
        queueOpenSharedPostViewer(post, true);
      } catch {
        // unavailable
      }
    })();
  }, [token]);

  return (
    <NotificationPanelProvider>
      <View style={styles.root}>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            lazy: true,
            freezeOnBlur: true
          }}
          detachInactiveScreens
          tabBar={(props) => (
            <MainTabBar
              {...props}
              createFocused={isCreateOpen}
              onCreatePress={() => {
                if (isAccountDeactivated) return;
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
                  if (isAccountDeactivated) return;
                  setCreatePresetType(type ?? null);
                  setCreateLiveOptions(options ?? null);
                  setCreateOpen(true);
                }}
              />
            )}
          />
          {/* Defer non-Home tabs until first visit — avoids parsing Search/Market/Chat/etc at cold start. */}
          <Tab.Screen
            name="Search"
            getComponent={() => require("../screens/UserSearchScreen").UserSearchScreen}
          />
          <Tab.Screen
            name="Market"
            getComponent={() => require("./MarketStackNavigator").MarketStackNavigator}
          />
          <Tab.Screen
            name="Learn"
            getComponent={() => require("./LearnStackNavigator").LearnStackNavigator}
          />
          <Tab.Screen
            name="Services"
            getComponent={() => require("../screens/ServicesScreen").ServicesScreen}
          />
          <Tab.Screen
            name="Messages"
            getComponent={() => require("../screens/messaging/DirectInboxScreen").DirectInboxScreen}
          />
          <Tab.Screen
            name="Profile"
            getComponent={() => require("../screens/ProfileScreen").ProfileScreen}
          />
        </Tab.Navigator>
        {isCreateOpen ? (
          <Suspense fallback={<CreateModalFallback />}>
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
          </Suspense>
        ) : null}
      </View>
    </NotificationPanelProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#262626" },
  createFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50
  }
});
