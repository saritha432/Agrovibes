const { withAndroidManifest } = require("@expo/config-plugins");

/** Request a larger Dalvik heap on Android (helps video / WebRTC on mid-range devices). */
module.exports = function withAndroidLargeHeap(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (application?.$) {
      application.$["android:largeHeap"] = "true";
    }
    return cfg;
  });
};
