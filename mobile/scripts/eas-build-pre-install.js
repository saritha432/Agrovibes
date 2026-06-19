#!/usr/bin/env node
/**
 * Strip dev-only native modules from EAS preview/production builds to shrink APK size.
 * Local dev builds (`npm start` / development profile) keep expo-dev-client.
 */
const { execSync } = require("node:child_process");

const profile = String(process.env.EAS_BUILD_PROFILE || "").toLowerCase();
const stripDevClient = profile === "preview" || profile === "production";

if (!stripDevClient) {
  process.exit(0);
}

try {
  execSync("npm uninstall expo-dev-client --no-save", { stdio: "inherit" });
} catch {
  // Package may already be absent.
}
