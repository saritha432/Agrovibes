const appJson = require("./app.json");
const fs = require("fs");
const path = require("path");

const FIREBASE_PLUGINS = ["./plugins/withFirebase.js"];
const IOS_GOOGLE_SERVICES_FILE = "./GoogleService-Info.plist";

function isFirebasePlugin(entry) {
  if (typeof entry === "string") {
    return (
      entry.startsWith("@react-native-firebase/") ||
      entry.includes("withFirebase")
    );
  }
  if (Array.isArray(entry) && typeof entry[0] === "string") {
    const id = entry[0];
    return id.startsWith("@react-native-firebase/") || id.includes("withFirebase");
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

function assertIosFirebaseConfig() {
  const buildingIos =
    process.env.EAS_BUILD_PLATFORM === "ios" ||
    (Array.isArray(process.argv) && process.argv.some((arg) => String(arg).includes("ios")));
  if (!buildingIos || !shouldIncludeFirebasePlugins()) {
    return;
  }

  const plistPath = path.resolve(__dirname, IOS_GOOGLE_SERVICES_FILE);
  if (fs.existsSync(plistPath)) {
    return;
  }

  throw new Error(
    [
      "iOS EAS build requires GoogleService-Info.plist for Firebase (Analytics/Crashlytics).",
      "1. Open Firebase Console → project cropvibe → Add app → iOS",
      "2. Bundle ID: com.cropvibe.app",
      "3. Download GoogleService-Info.plist into mobile/",
      "4. Re-run: npm run build:ios:prod"
    ].join("\n")
  );
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = () => {
  assertIosFirebaseConfig();

  const base = appJson.expo;
  const plugins = (base.plugins || []).filter((entry) => !isFirebasePlugin(entry));

  if (shouldIncludeFirebasePlugins()) {
    plugins.unshift(...FIREBASE_PLUGINS);
  }

  return {
    ...base,
    ios: {
      ...base.ios,
      googleServicesFile: IOS_GOOGLE_SERVICES_FILE
    },
    plugins
  };
};
