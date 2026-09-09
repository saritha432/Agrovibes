const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * React Native < 0.81 does not receive Android 13+ predictive-back events.
 * With targetSdk 35/36 the system finishes the Activity instead of calling
 * ReactActivity.onBackPressed → JS BackHandler — so gesture/back button exits
 * the app while in-app back icons still work.
 *
 * Opt out at BOTH application and activity level (application alone is required).
 */
function withAndroidLegacyBackHandler(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return cfg;

    application.$ = application.$ || {};
    application.$["android:enableOnBackInvokedCallback"] = "false";

    if (Array.isArray(application.activity)) {
      for (const activity of application.activity) {
        activity.$ = activity.$ || {};
        activity.$["android:enableOnBackInvokedCallback"] = "false";
      }
    }

    return cfg;
  });
}

module.exports = withAndroidLegacyBackHandler;
