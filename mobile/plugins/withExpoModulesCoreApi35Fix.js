const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const TARGET =
  "node_modules/expo-modules-core/android/src/main/java/expo/modules/adapters/react/permissions/PermissionsService.kt";
const OLD = "return requestedPermissions.contains(permission)";
const FIXED = "return requestedPermissions?.contains(permission) ?: false";

/**
 * Expo SDK 51 + compileSdk 35: expo-modules-core@1.12.26 fails Kotlin compile
 * because PackageInfo.requestedPermissions is nullable on API 35.
 * Remove when upgrading to Expo SDK 52+.
 */
function withExpoModulesCoreApi35Fix(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const file = path.join(cfg.modRequest.projectRoot, TARGET);
      if (!fs.existsSync(file)) {
        return cfg;
      }
      const content = fs.readFileSync(file, "utf8");
      if (content.includes(OLD) && !content.includes(FIXED)) {
        fs.writeFileSync(file, content.replace(OLD, FIXED));
      }
      return cfg;
    },
  ]);
}

module.exports = withExpoModulesCoreApi35Fix;
