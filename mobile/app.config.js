const appJson = require("./app.json");

const FIREBASE_PLUGINS = ["@react-native-firebase/app", "@react-native-firebase/crashlytics"];

function isFirebasePlugin(entry) {
  if (typeof entry === "string") {
    return entry.startsWith("@react-native-firebase/");
  }
  if (Array.isArray(entry) && typeof entry[0] === "string") {
    return entry[0].startsWith("@react-native-firebase/");
  }
  return false;
}

function shouldIncludeFirebasePlugins() {
  return (
    process.env.EAS_BUILD === "true" ||
    process.env.EAS_BUILD === "1" ||
    process.env.INCLUDE_FIREBASE_PLUGINS === "1"
  );
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = () => {
  const base = appJson.expo;
  const plugins = (base.plugins || []).filter((entry) => !isFirebasePlugin(entry));

  if (shouldIncludeFirebasePlugins()) {
    plugins.unshift(...FIREBASE_PLUGINS);
  }

  return {
    ...base,
    plugins
  };
};
