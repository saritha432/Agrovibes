const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
// Bump when resolver/layout changes so stale per-platform Metro caches rebuild (web vs android).
config.cacheVersion = "cropvibe-ios-safe-area-v1";
const firebaseWebStub = path.resolve(__dirname, "src/firebase/stubs/emptyModule.js");
const safeAreaShim = path.resolve(__dirname, "src/safeArea/safeAreaContextShim.tsx");

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web") {
    if (
      moduleName.startsWith("@react-native-firebase/") ||
      moduleName === "firebase/app" ||
      moduleName.startsWith("firebase/") ||
      moduleName === "react-native-full-screen-notification-incoming-call"
    ) {
      return { type: "sourceFile", filePath: firebaseWebStub };
    }
  }

  // App code gets JS SafeAreaView (iOS status-bar fallback). Shim folder still resolves the real package.
  if (moduleName === "react-native-safe-area-context") {
    const origin = String(context.originModulePath || "").replace(/\\/g, "/");
    const fromShim = origin.includes("/src/safeArea/");
    if (!fromShim) {
      return { type: "sourceFile", filePath: safeAreaShim };
    }
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
