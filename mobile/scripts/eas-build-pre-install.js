#!/usr/bin/env node
/**
 * Runs before `npm install` on EAS Build.
 *
 * Do not mutate package.json here — EAS runs `npm ci --include=dev`, which
 * requires package.json and package-lock.json to stay in sync.
 *
 * Dev-client native modules are excluded from store builds via
 * app.config.js autolinking + eas-build-post-install cleanup.
 */
const fs = require("fs");
const path = require("path");

const profile = String(process.env.EAS_BUILD_PROFILE || "").toLowerCase();
const isDevBuild = profile === "development";

const projectRoot = path.join(__dirname, "..");
const pkgPath = path.join(projectRoot, "package.json");
const DEV_CLIENT_VERSION = "~5.2.4";

function readPackageJson() {
  return JSON.parse(fs.readFileSync(pkgPath, "utf8"));
}

function writePackageJson(pkg) {
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

// Remove any leftover omit=dev .npmrc from older builds — EAS uses --include=dev.
const npmrcPath = path.join(projectRoot, ".npmrc");
if (fs.existsSync(npmrcPath)) {
  const existing = fs.readFileSync(npmrcPath, "utf8");
  if (existing.includes("omit=dev")) {
    const next = existing
      .split(/\r?\n/)
      .filter((line) => !/^\s*omit\s*=\s*dev\s*$/i.test(line))
      .join("\n")
      .trim();
    if (next) {
      fs.writeFileSync(npmrcPath, `${next}\n`);
    } else {
      fs.unlinkSync(npmrcPath);
    }
    // eslint-disable-next-line no-console
    console.log("[eas-build-pre-install] removed omit=dev (EAS uses --include=dev)");
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
