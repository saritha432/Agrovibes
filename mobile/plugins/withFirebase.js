const { withPlugins } = require("@expo/config-plugins");

const withRnFirebaseApp = require("@react-native-firebase/app/app.plugin.js");
const withRnFirebaseCrashlytics = require("@react-native-firebase/crashlytics/app.plugin.js");

const appPlugin = withRnFirebaseApp.default || withRnFirebaseApp;
const crashPlugin = withRnFirebaseCrashlytics.default || withRnFirebaseCrashlytics;

/** Chains Firebase App + Crashlytics native config for EAS builds. */
module.exports = function withFirebase(config) {
  return withPlugins(config, [appPlugin, crashPlugin]);
};
