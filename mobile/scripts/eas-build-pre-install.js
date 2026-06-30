#!/usr/bin/env node
/**
 * Runs before `npm install` on EAS Build.
 * Store builds must never install expo-dev-client (iOS runs pod install before post-install).
 */
const fs = require("fs");
const path = require("path");

const profile = String(process.env.EAS_BUILD_PROFILE || "").toLowerCase();
const isStoreBuild = profile === "preview" || profile === "production";
const isDevBuild = profile === "development";

const projectRoot = path.join(__dirname, "..");
const pkgPath = path.join(projectRoot, "package.json");
const DEV_CLIENT_VERSION = "~4.0.29";

function readPackageJson() {
  return JSON.parse(fs.readFileSync(pkgPath, "utf8"));
}

function writePackageJson(pkg) {
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

if (isStoreBuild) {
  const pkg = readPackageJson();
  if (pkg.devDependencies?.["expo-dev-client"]) {
    delete pkg.devDependencies["expo-dev-client"];
    if (Object.keys(pkg.devDependencies).length === 0) {
      delete pkg.devDependencies;
    }
    writePackageJson(pkg);
    // eslint-disable-next-line no-console
    console.log("[eas-build-pre-install] removed expo-dev-client for store build");
  }

  const npmrcPath = path.join(projectRoot, ".npmrc");
  const npmrcLine = "omit=dev\n";
  const existing = fs.existsSync(npmrcPath) ? fs.readFileSync(npmrcPath, "utf8") : "";
  if (!existing.includes("omit=dev")) {
    fs.writeFileSync(npmrcPath, `${existing}${existing.endsWith("\n") || existing.length === 0 ? "" : "\n"}${npmrcLine}`);
    // eslint-disable-next-line no-console
    console.log("[eas-build-pre-install] enabled omit=dev in .npmrc");
  }
}

if (isDevBuild) {
  const pkg = readPackageJson();
  pkg.devDependencies = pkg.devDependencies || {};
  if (!pkg.devDependencies["expo-dev-client"]) {
    pkg.devDependencies["expo-dev-client"] = DEV_CLIENT_VERSION;
    writePackageJson(pkg);
    // eslint-disable-next-line no-console
    console.log("[eas-build-pre-install] ensured expo-dev-client for development build");
  }
}
