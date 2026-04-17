import React from "react";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppNavigator } from "./AppNavigator";
import { AuthScreen } from "../screens/AuthScreen";
import { InstructorStudioScreen } from "../screens/InstructorStudioScreen";
import type { MarketStackParamList } from "./MarketStackNavigator";
import type { LearnStackParamList } from "./LearnStackNavigator";

export type MainTabParamList = {
  Home: undefined;
  Market: NavigatorScreenParams<MarketStackParamList>;
  Learn: NavigatorScreenParams<LearnStackParamList>;
  Services: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Auth: undefined;
  InstructorStudio: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={AppNavigator} />
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="InstructorStudio" component={InstructorStudioScreen} />
    </Stack.Navigator>
  );
}

