const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
const firebaseWebStub = path.resolve(__dirname, "src/firebase/stubs/emptyModule.js");

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web") {
    if (
      moduleName.startsWith("@react-native-firebase/") ||
      moduleName === "firebase/app" ||
      moduleName.startsWith("firebase/")
    ) {
      return { type: "sourceFile", filePath: firebaseWebStub };
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
