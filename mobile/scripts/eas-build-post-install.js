#!/usr/bin/env node
/**
 * Runs after `npm install` on EAS Build.
 * - Applies node_modules patches (API 35 Kotlin fix)
 * - Strips expo-dev-client from store builds (pre-install runs too early)
 */
const { execSync } = require("node:child_process");
const fs = require("fs");
const path = require("path");

const profile = String(process.env.EAS_BUILD_PROFILE || "").toLowerCase();
const isStoreBuild = profile === "preview" || profile === "production";

try {
  execSync("npx patch-package", { stdio: "inherit" });
} catch {
  // patch-package may be absent in some local installs
}

if (isStoreBuild) {
  try {
    execSync("npm uninstall expo-dev-client --no-save", { stdio: "inherit" });
  } catch {
    // Already removed.
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

const projectRoot = path.join(__dirname, "..");

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
