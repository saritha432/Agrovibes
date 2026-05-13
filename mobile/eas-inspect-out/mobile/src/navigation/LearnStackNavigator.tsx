import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LearnScreen } from "../screens/LearnScreen";
import { CourseDetailScreen } from "../screens/CourseDetailScreen";
import { CoursePlayerScreen } from "../screens/CoursePlayerScreen";
import { LessonVideoScreen } from "../screens/LessonVideoScreen";

export type LearnStackParamList = {
  LearnHome: undefined;
  CourseDetail: { courseId: string };
  CoursePlayer: { courseId: string };
  LessonVideo: { courseId: string; lessonId: string; autoPlay?: boolean };
};

const Stack = createNativeStackNavigator<LearnStackParamList>();

export function LearnStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LearnHome" component={LearnScreen} />
      <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
      <Stack.Screen name="CoursePlayer" component={CoursePlayerScreen} />
      <Stack.Screen name="LessonVideo" component={LessonVideoScreen} />
    </Stack.Navigator>
  );
}

