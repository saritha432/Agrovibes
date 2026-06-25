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

// Belt-and-suspenders: apply Kotlin fix if patch-package did not run.
const permissionsFile = path.join(
  __dirname,
  "..",
  "node_modules/expo-modules-core/android/src/main/java/expo/modules/adapters/react/permissions/PermissionsService.kt"
);
const oldLine = "return requestedPermissions.contains(permission)";
const fixedLine = "return requestedPermissions?.contains(permission) ?: false";

if (fs.existsSync(permissionsFile)) {
  const content = fs.readFileSync(permissionsFile, "utf8");
  if (content.includes(oldLine) && !content.includes(fixedLine)) {
    fs.writeFileSync(permissionsFile, content.replace(oldLine, fixedLine));
  }
}
