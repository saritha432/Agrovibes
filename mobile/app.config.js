/**
 * Dynamic Expo config — disables OTA updates on preview APKs so a bad
 * "preview" channel update cannot crash the app immediately on launch.
 */
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE || "";
  const disableUpdates = profile === "preview";

  return {
    ...config,
    updates: {
      ...config.updates,
      enabled: disableUpdates ? false : config.updates?.enabled !== false,
      checkAutomatically: disableUpdates ? "NEVER" : config.updates?.checkAutomatically ?? "ON_LOAD"
    }
  };
};
