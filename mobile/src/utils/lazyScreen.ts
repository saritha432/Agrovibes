import React from "react";
import { Platform } from "react-native";

type ModuleFactory<T> = () => Promise<{ default: T }>;

/**
 * React.lazy + Metro dynamic import() often breaks on web after HMR
 * ("Requiring unknown module NNN"). Use require() on web; keep lazy on native.
 */
export function lazyScreen<T extends React.ComponentType<any>>(
  factory: ModuleFactory<T>,
  syncRequire: () => T
): T | React.LazyExoticComponent<T> {
  if (Platform.OS === "web") {
    return syncRequire();
  }
  return React.lazy(factory);
}
