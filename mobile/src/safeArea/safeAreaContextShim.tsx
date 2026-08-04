/**
 * Metro redirects `react-native-safe-area-context` app imports here so every
 * `SafeAreaView` uses padding-based insets (with iOS status-bar fallback).
 * The real package is still used for Provider / hooks (see metro.config.js).
 */
export * from "react-native-safe-area-context";
export { AppSafeAreaView as SafeAreaView } from "./AppSafeAreaView";
