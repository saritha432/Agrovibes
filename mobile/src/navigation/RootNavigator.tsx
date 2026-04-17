import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppNavigator } from "./AppNavigator";
import { AuthScreen } from "../screens/AuthScreen";
import { InstructorStudioScreen } from "../screens/InstructorStudioScreen";

export type RootStackParamList = {
  Main: undefined;
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

