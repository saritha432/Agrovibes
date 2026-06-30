#!/usr/bin/env node
/**
 * Runs after `npm install` on EAS Build.
 * - Applies node_modules patches (API 35 Kotlin fix)
 * - Strips expo dev-client packages from store builds (must run before prebuild/pod install)
 */
const { execSync } = require("node:child_process");
const fs = require("fs");
const path = require("path");

const profile = String(process.env.EAS_BUILD_PROFILE || "").toLowerCase();
const isStoreBuild = profile === "preview" || profile === "production";

const DEV_CLIENT_PACKAGES = [
  "expo-dev-client",
  "expo-dev-menu",
  "expo-dev-menu-interface",
  "expo-dev-launcher"
];

try {
  execSync("node scripts/patch-expo-device-xcode26.js", { stdio: "inherit" });
  execSync("npx patch-package", { stdio: "inherit" });
} catch {
  // patch-package may be absent in some local installs
}

const projectRoot = path.join(__dirname, "..");

// Do NOT delete dev-client packages here on iOS: pod install runs before this hook.
if (isStoreBuild && process.env.EAS_BUILD_PLATFORM === "android") {
  for (const pkg of DEV_CLIENT_PACKAGES) {
    const pkgDir = path.join(projectRoot, "node_modules", pkg);
    if (fs.existsSync(pkgDir)) {
      fs.rmSync(pkgDir, { recursive: true, force: true });
      // eslint-disable-next-line no-console
      console.log(`[eas-build-post-install] removed ${pkg} (android)`);
    }
  }
}

// Belt-and-suspenders: apply Kotlin fixes if patch-package did not run.
function applyTextFix(filePath, oldLine, fixedLine) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");
  if (content.includes(oldLine) && !content.includes(fixedLine)) {
    fs.writeFileSync(filePath, content.replaceAll(oldLine, fixedLine));
  }
}

applyTextFix(
  path.join(
    projectRoot,
    "node_modules/expo-modules-core/android/src/main/java/expo/modules/adapters/react/permissions/PermissionsService.kt"
  ),
  "return requestedPermissions.contains(permission)",
  "return requestedPermissions?.contains(permission) ?: false"
);

applyTextFix(
  path.join(
    projectRoot,
    "node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStack.kt"
  ),
  "if (drawingOpPool.isEmpty()) DrawingOp() else drawingOpPool.removeLast()",
  "if (drawingOpPool.isEmpty()) DrawingOp() else drawingOpPool.removeAt(drawingOpPool.lastIndex)"
);
